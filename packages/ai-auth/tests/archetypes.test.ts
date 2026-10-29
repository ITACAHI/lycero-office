/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { describe, expect, it } from 'vitest'
import {
  ARCHETYPES,
  findArchetype,
  findArchetypeByKey,
} from '../src/archetypes'

describe('archetypes', () => {
  it('has a default archetype at id 0', () => {
    expect(ARCHETYPES[0]?.id).toBe(0)
    expect(ARCHETYPES[0]?.key).toBe('general_office')
  })

  it('every entry has a unique id and key', () => {
    const ids = ARCHETYPES.map((a) => a.id)
    const keys = ARCHETYPES.map((a) => a.key)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('findArchetype returns the matching entry', () => {
    const a = findArchetype(3)
    expect(a.key).toBe('small_business')
  })

  it('findArchetype falls back to the default when id is missing or invalid', () => {
    expect(findArchetype(-1).id).toBe(0)
    expect(findArchetype(undefined).id).toBe(0)
    expect(findArchetype(99).id).toBe(0)
  })

  it('findArchetypeByKey returns the matching entry', () => {
    const a = findArchetypeByKey('higher_ed')
    expect(a.id).toBe(9)
  })

  it('findArchetypeByKey falls back to the default on empty / unknown key', () => {
    expect(findArchetypeByKey(undefined).id).toBe(0)
    expect(findArchetypeByKey('').id).toBe(0)
    expect(findArchetypeByKey('not_a_real_key').id).toBe(0)
  })
})
