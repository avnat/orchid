import { useStore } from '../store/useStore'

export default function ConflictBanner(): JSX.Element {
  const resolve = useStore((s) => s.resolveConflict)
  return (
    <div className="banner" role="alert">
      <span className="warn">⚠ File changed on disk</span>
      <span>This file was modified outside Orchid while you have unsaved edits.</span>
      <span className="spacer" />
      <button onClick={() => resolve('mine')}>Keep mine</button>
      <button onClick={() => resolve('theirs')}>Load theirs</button>
    </div>
  )
}
