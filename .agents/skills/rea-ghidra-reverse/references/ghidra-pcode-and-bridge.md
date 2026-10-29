# Ghidra 12.3 Internals, SSA P-code IR & `ReaGhidraBridge` Reference

## 1. Local Source & Runtime Paths

| Component | Path on Machine | Notes |
|---|---|---|
| **Ghidra 12.3-DEV Source** | `D:\ghidra-upstream-20261028` | Commit `1b9e58a9` (20,623 files: Framework, Processors, Decompiler C++, Features, Debug, Extensions) |
| **C++ Decompiler Engine** | `D:\ghidra-upstream-20261028\Ghidra\Features\Decompiler\src\decompile\cpp` | ~180 C++ header/source files (`heritage.hh`, `coreaction.hh`, `ruleaction.hh`, `blockaction.hh`, `printc.hh`) |
| **SLEIGH Processor Specs** | `D:\ghidra-upstream-20261028\Ghidra\Processors` | 39 CPU architectures (`.slaspec`, `.sinc`, `.cspec`, `.ldefs`) |
| **REA Headless Ghidra Bridge** | `D:\rea-upstream-20261028\bridge\ghidra\ReaGhidraBridge.java` | 5,018-line `HeadlessScript` serving authenticated Unix Domain Socket / TCP RPC |
| **REA NativeAOT Extension** | `D:\rea-upstream-20261028\bridge\ghidra\NativeAotExtension.java` | .NET 8/9 ReadyToRun (RTR) & MethodTable recovery |

---

## 2. Understanding Ghidra's Native C++ Decompiler Pipeline

When `ReaGhidraBridge` calls `DecompInterface.decompileFunction(func, timeout, monitor)`, the Java host streams binary P-code and symbol context to the native C++ `decompile` process (`ghidra_process.hh`). The C++ engine executes **6 mathematical phases**:

1. **SLEIGH Lifting (`sleigh.hh`, `flow.hh`):**
   - Decodes machine bytes into **Raw P-code** operating on **`Varnode`** tuples `(AddressSpace, Offset, Size)`.
   - Address spaces include `ram`, `register`, `unique` (temporary registers), `stack`, and `const`.
2. **Staged SSA Construction (`heritage.hh` — `Heritage::heritage()`):**
   - Computes the CFG Dominator Tree and inserts **`MULTIEQUAL` ($\phi$-nodes)** and **`INDIRECT`** ops.
   - Runs in multiple passes: Pass 0 lifts CPU registers into SSA; once stack pointer (`RSP`/`SP`) offsets are simplified into constants, Pass 1+ lifts stack-frame slots into SSA variables (**High P-code**).
3. **Fixed-Point Rule Simplification (`coreaction.hh`, `ruleaction.hh`, `subflow.hh`):**
   - Runs **130+ algebraic and data-flow rewrite rules** iteratively until a fixed point is reached:
     - Dead-code elimination (`ActionDeadCode`).
     - Constant & copy propagation (`RulePropagateCopy`, `RuleTermOrder`).
     - Magic-number division recovery (`RuleDivTermAdd`, `RuleDivOpt`).
     - Bitfield & sub-register splitting (`SubvariableFlow`, `SplitFlow`, `prefersplit.hh`).
     - Jump-table (`switch`) target recovery via value-set range analysis (`jumptable.hh`, `rangeutil.hh`).
4. **Type Propagation & Prototype Recovery (`type.hh`, `typeop.hh`, `fspec.hh`):**
   - Propagates data types along `Varnode` Def-Use chains.
   - Converts raw pointer additions into struct field accesses (`PTRSUB`) and array indexing (`PTRADD`).
5. **CFG Structuring (`blockaction.hh`, `block.hh`):**
   - Collapses basic blocks into structured AST regions (`BlockIf`, `BlockWhileDo`, `BlockDoWhile`, `BlockInfLoop`, `BlockSwitch`), emitting `goto` only on irreducible control flow.
6. **C AST Emission (`printc.hh` $\rightarrow$ `ClangTokenGroup`):**
   - Emits C syntax tokens linked back to exact machine instruction addresses and `PcodeOpAST` nodes.

---

## 3. Reading High P-code & Value-Flow in REA (`analyze_function`)

Sometimes decompiled C hides critical security flaws (e.g., integer overflow elided by type inference, or register aliasing across an indirect call). Always inspect the **High P-code** facets via `inspect_analysis_view`:

```json
{
  "source": "<parent_evidence_id>",
  "view": {
    "kind": "native",
    "facet": "value_flow_operations",
    "offset": 0,
    "limit": 64
  }
}
```

### Key P-code Opcodes to Watch For:
| P-code Op | Meaning in SSA (`HighFunction`) | Security / Reverse Engineering Significance |
|---|---|---|
| `MULTIEQUAL` | SSA $\phi$-node merging values from multiple predecessor basic blocks | Reveals loop induction variables and state-machine transitions. |
| `INDIRECT` | Value potentially modified by an indirect effect (e.g., `CALL` modifying stack/globals) | Indicates alias boundaries where Ghidra could not prove memory immutability. |
| `PTRSUB` | `base + offset` into a known structure or stack frame | Directly reveals struct field offsets (`offset` input varnode). |
| `PTRADD` | `base + index * element_size` | Reveals array indexing and element stride (`element_size`). |
| `SUBPIECE` / `PIECE` | Truncation or concatenation of registers (e.g., `RAX` $\rightarrow$ `EAX` or `AL`) | Common source of integer truncation bugs and sign-extension mismatches (`INT_SEXT` vs `INT_ZEXT`). |
| `CALLIND` / `BRANCHIND` | Indirect function call or jump through register/memory pointer | C++ vtable dispatch, function pointer callback, or jump table. Check `SymbolicPropogator` output or corroborate with Stage 4 runtime tracing. |

### `ReaGhidraBridge` Safety Ceilings (`ReaGhidraBridge.java`):
- `MAX_HIGH_PCODE_OPS = 3000`: Functions exceeding 3,000 High P-code ops will report truncated value-flow with explicit limitation metadata.
- `MAX_HIGH_PCODE_DEF_USE_EDGES = 12000`: Bounds Def-Use graph edges per function dossier.
- `MAX_DECOMPILE_CHARS = 160000`: Bounds C pseudocode string length.

---

## 4. Writing Custom Headless PyGhidra Scripts (Ghidra 12.3)

When a task requires direct access to Ghidra 12.3 features not exposed by standard MCP tools (such as **BSim**, **SymbolicSummaryZ3**, **TaintAnalysis**, or custom **Rust/Swift/Go** struct reconstruction), write a headless PyGhidra script (`Ghidra/Features/PyGhidra`):

```python
# Example PyGhidra script accessing HighFunction SSA P-code directly
from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor

ifc = DecompInterface()
ifc.openProgram(currentProgram)
monitor = ConsoleTaskMonitor()

fm = currentProgram.getFunctionManager()
for func in fm.getFunctions(True):
    res = ifc.decompileFunction(func, 60, monitor)
    if not res.decompileCompleted():
        continue
    hf = res.getHighFunction()
    for op in hf.getPcodeOps():
        if op.getMnemonic() == "CALLIND":
            print(f"[CALLIND] {func.getName()} @ {op.getSeqnum().getTarget()}: target={op.getInput(0)}")
```
