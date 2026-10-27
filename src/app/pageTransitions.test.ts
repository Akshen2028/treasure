import { describe, expect, it } from 'vitest'

import { navDirection } from './pageTransitions'
import { paths as appPaths, weddingPaths } from './paths'

const paths = { welcome: appPaths.welcome, ...weddingPaths('alex-sam') }

describe('navDirection', () => {
  it('slides forward when drilling into the hierarchy', () => {
    expect(navDirection(paths.welcome, paths.home)).toBe('forward')
    expect(navDirection(paths.home, paths.event('e1'))).toBe('forward')
    expect(navDirection(paths.event('e1'), paths.category('e1', 'c1'))).toBe('forward')
    expect(navDirection(paths.search, paths.activity('e1', 'c1', 'a1'))).toBe('forward')
    expect(navDirection(paths.settings, paths.recentlyDeleted)).toBe('forward')
  })

  it('slides back when going up', () => {
    expect(navDirection(paths.payments('e1', 'c1', 'a1'), paths.activity('e1', 'c1', 'a1'))).toBe(
      'back',
    )
    expect(navDirection(paths.category('e1', 'c1'), paths.event('e1'))).toBe('back')
    expect(navDirection(paths.event('e1'), paths.home)).toBe('back')
  })

  it('cross-fades between screens at the same level', () => {
    expect(navDirection(paths.home, paths.search)).toBe('fade')
    expect(navDirection(paths.search, paths.settings)).toBe('fade')
    expect(navDirection(paths.event('e1'), paths.event('e2'))).toBe('fade')
  })

  it('raises the assistant like a sheet and lowers it again', () => {
    expect(navDirection(paths.home, paths.chat)).toBe('up')
    expect(navDirection(paths.activity('e1', 'c1', 'a1'), paths.chat)).toBe('up')
    expect(navDirection(paths.chat, paths.category('e1', 'c1'))).toBe('down')
  })

  it('ignores the wedding prefix when measuring depth', () => {
    expect(navDirection('/home', paths.home)).toBe('fade')
    expect(navDirection(paths.home, '/w/a-chat/events/e1')).toBe('forward')
    expect(navDirection(paths.home, '/w/chat/home')).toBe('fade')
  })
})
