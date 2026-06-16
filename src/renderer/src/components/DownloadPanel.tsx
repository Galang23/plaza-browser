import { useStore } from '../store/useStore'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatProgress(received: number, total: number): string {
  if (total === 0) return 'Unknown'
  return `${((received / total) * 100).toFixed(0)}%`
}

export function DownloadPanel({ onClose }: { onClose: () => void }) {
  const downloads = useStore((s) => s.downloads)

  const active = downloads.filter((d) => d.state === 'progressing')
  const complete = downloads.filter((d) => d.state === 'completed')
  const other = downloads.filter((d) => d.state !== 'progressing' && d.state !== 'completed')
  const sorted = [...active, ...complete, ...other].slice(0, 15)

  return (
    <div className="download-panel-overlay" onClick={onClose}>
      <div className="download-panel" onClick={(e) => e.stopPropagation()}>
        <div className="download-panel-header">
          <span>Downloads</span>
          <button className="download-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="download-panel-body">
          {sorted.length === 0 ? (
            <div className="download-empty">No downloads</div>
          ) : (
            sorted.map((d) => (
              <div key={d.id} className={`download-item ${d.state}`}>
                <span className="download-filename" title={d.filename}>{d.filename}</span>
                <span className="download-info">
                  {d.state === 'progressing'
                    ? `${formatProgress(d.receivedBytes, d.totalBytes)} of ${formatBytes(d.totalBytes)}`
                    : d.state}
                </span>
                {d.state === 'progressing' && d.totalBytes > 0 && (
                  <div className="download-bar">
                    <div
                      className="download-bar-fill"
                      style={{ width: `${(d.receivedBytes / d.totalBytes) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
