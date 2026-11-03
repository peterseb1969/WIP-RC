import { describe, it, expect } from 'vitest'
import { WipConflictError, WipValidationError, MANAGED_BY_DEPLOYER } from '@wip/client'
import {
  isKeyReadOnly,
  isManaged,
  isManagedRefusal,
  keyGrantsManaged,
  managedKeyHint,
} from '@/lib/managed-records'

// wip-deploy's records are read-only in the console, identified by
// managed_by (not by source, which changes when the services switch to the
// Registry's records). A refused write is recognised by its error code.

describe('isKeyReadOnly', () => {
  it('is true for wip-deploy keys whatever their source, and for unimported config keys', () => {
    expect(isKeyReadOnly({ managed_by: 'wip-deploy', source: 'config' })).toBe(true)
    expect(isKeyReadOnly({ managed_by: 'wip-deploy', source: 'runtime' })).toBe(true)
    expect(isKeyReadOnly({ managed_by: null, source: 'config' })).toBe(true)
    expect(isKeyReadOnly({ source: 'config' })).toBe(true)
  })

  it('is false for console keys, including restored ones', () => {
    expect(isKeyReadOnly({ managed_by: null, source: 'runtime' })).toBe(false)
    expect(isKeyReadOnly({ source: 'runtime' })).toBe(false)
  })
})

describe('keyGrantsManaged', () => {
  it('is true for a wip-deploy key whose file entry declares grants, even none', () => {
    expect(keyGrantsManaged({ managed_by: 'wip-deploy', grants: { kb: 'admin' } })).toBe(true)
    expect(keyGrantsManaged({ managed_by: 'wip-deploy', grants: {} })).toBe(true)
  })

  it('is false when the key declares no grants, or is not wip-deploy\'s', () => {
    expect(keyGrantsManaged({ managed_by: 'wip-deploy', grants: null })).toBe(false)
    expect(keyGrantsManaged({ managed_by: 'wip-deploy' })).toBe(false)
    expect(keyGrantsManaged({ managed_by: null, grants: { kb: 'write' } })).toBe(false)
  })
})

describe('isManaged', () => {
  it('reads managed_by', () => {
    expect(isManaged({ managed_by: 'wip-deploy' })).toBe(true)
    expect(isManaged({ managed_by: null })).toBe(false)
    expect(isManaged({})).toBe(false)
  })
})

describe('isManagedRefusal', () => {
  it('recognises the Registry refusal by its error code', () => {
    const body = { detail: 'Managed by wip-deploy', error_code: MANAGED_BY_DEPLOYER }
    expect(isManagedRefusal(new WipConflictError('Managed by wip-deploy', body))).toBe(true)
  })

  it('ignores other conflicts, other errors and plain errors', () => {
    expect(isManagedRefusal(new WipConflictError('Runtime key exists', { detail: 'Runtime key exists' }))).toBe(false)
    expect(isManagedRefusal(new WipValidationError('bad', { detail: 'bad', error_code: 'other' }))).toBe(false)
    expect(isManagedRefusal(new Error('managed_by_deployer'))).toBe(false)
    expect(isManagedRefusal(undefined)).toBe(false)
  })
})

describe('managedKeyHint', () => {
  it('names the app commands for an app key', () => {
    const hint = managedKeyHint('app-wip-kb')
    expect(hint).toContain('wip-deploy app-namespace add|remove wip-kb <namespace>')
    expect(hint).toContain('wip-deploy rotate-key app-wip-kb')
  })

  it('names rotate-key for a declared key', () => {
    expect(managedKeyHint('wip-canary')).toContain('wip-deploy rotate-key wip-canary')
    expect(managedKeyHint('wip-canary')).not.toContain('app-namespace')
  })
})
