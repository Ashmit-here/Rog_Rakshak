import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

const PAGE_SIZE = 10

function formatReportDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function HospitalMinePage() {
  const [reports, setReports] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/reports/mine?page=${page}&limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ reports: rows, pagination: pageInfo }) => {
        if (controller.signal.aborted) return
        setReports(rows)
        setPagination(pageInfo)
        setError('')
      })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestError.name !== 'AbortError') {
          setError(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, retry])

  function loadPage(nextPage) {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  function retryLoad() {
    setLoading(true)
    setError('')
    setRetry((value) => value + 1)
  }

  return (
    <section className="workspace-content report-workspace">
      <p className="eyebrow">HOSPITAL WORKSPACE</p>
      <h1>My reports</h1>
      <p className="workspace-lead">Reports submitted through your hospital and their review status.</p>

      {loading && (
        <div className="state-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading your reports…
        </div>
      )}
      {!loading && error && (
        <div className="state-card state-card-error" role="alert">
          <strong>Reports could not be loaded</strong>
          <span>{error}</span>
          <button className="button button-outline button-small" type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && reports.length === 0 && (
        <div className="state-card state-card-empty">
          <span className="empty-mark" aria-hidden="true">○</span>
          <strong>No reports yet</strong>
          <span>Submitted reports will appear here.</span>
        </div>
      )}
      {!loading && !error && reports.length > 0 && (
        <>
          <div className="report-list">
            {reports.map((report) => (
              <article className="data-card report-card" key={report.id}>
                <div className="report-card-heading">
                  <div>
                    <p className="eyebrow">REPORTED {formatReportDate(report.reportedAt)}</p>
                    <h2>{report.area.name}</h2>
                    <p className="muted-copy">{report.area.district.name}</p>
                  </div>
                  <span className={`report-status status-${report.status.toLowerCase()}`}>
                    {report.status.toLowerCase()}
                  </span>
                </div>
                <ul className="report-disease-list">
                  {report.lines.map((line) => (
                    <li key={line.id}>
                      <span>{line.disease.name}</span>
                      <strong>{line.caseCount.toLocaleString()} cases</strong>
                    </li>
                  ))}
                </ul>
                {report.reviewNotes && (
                  <div className="review-notes">
                    <strong>Review notes</strong>
                    <p>{report.reviewNotes}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="pagination-row" aria-label="Report pages">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} reports
            </span>
            <div>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => loadPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => loadPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default HospitalMinePage
