import { describe, it, expect } from 'vitest'
import { isMarkdownFile, langForFile } from '../src/renderer/src/markdown/langs'

describe('isMarkdownFile', () => {
  it('matches markdown extensions case-insensitively', () => {
    expect(isMarkdownFile('readme.md')).toBe(true)
    expect(isMarkdownFile('NOTES.MARKDOWN')).toBe(true)
    expect(isMarkdownFile('doc.mdx')).toBe(true)
  })

  it('rejects non-markdown files', () => {
    expect(isMarkdownFile('script.js')).toBe(false)
    expect(isMarkdownFile('plain.txt')).toBe(false)
    expect(isMarkdownFile('mdfile')).toBe(false)
  })
})

describe('langForFile', () => {
  it.each([
    'a.md',
    'a.markdown',
    'a.mdx',
    'a.py',
    'a.c',
    'a.h',
    'a.cpp',
    'a.cc',
    'a.hpp',
    'a.js',
    'a.jsx',
    'a.ts',
    'a.tsx',
    'a.json',
    'a.swift',
    'a.sh',
    'a.bash',
    'a.zsh',
    'a.yml',
    'a.yaml'
  ])('returns a CodeMirror extension for %s', (name) => {
    expect(langForFile(name)).not.toBeNull()
  })

  it('is case-insensitive on the extension', () => {
    expect(langForFile('Main.PY')).not.toBeNull()
  })

  it('returns null for plain text / unknown extensions', () => {
    expect(langForFile('notes.txt')).toBeNull()
    expect(langForFile('data.csv')).toBeNull()
    expect(langForFile('noextension')).toBeNull()
  })
})
