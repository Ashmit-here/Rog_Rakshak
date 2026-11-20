import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

const PAGE_SIZE = 10
const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
]

function formatReportDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function MedicalOfficerHistoryPage() {
  const [reports, setReports] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/reports/history?status=${status}&page=${page}&limit=${PAGE_SIZE}`, {
      signal: controller.signal,
    })
      .then(({ reports: rows, pagination: pageInfo }) => {
        setReports(rows)
        setPagination(pageInfo)
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, refreshKey, status])

  function chooseStatus(nextStatus) {
    if (nextStatus === status && page === 1) return
    setLoading(true)
    setError('')
    setStatus(nextStatus)
    setPage(1)
  }

  function loadPage(nextPage) {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  function retryLoad() {
    setLoading(true)
    setError('')
    setRefreshKey((value) => value + 1)
  }

  return (
    <section className="workspace-content report-workspace">
      <p className="eyebrow">MEDICAL OFFICER WORKSPACE</p>
      <h1>Review history</h1>
      <p className="workspace-lead">
        Reports you have verified or rejected in your assigned areas.
      </p>

      <div className="filter-bar" role="group" aria-label="Filter review history by status">
        {STATUS_FILTERS.map((filter) => (
          <button
            className={status === filter.value ? 'button button-primary button-small' : 'button button-secondary button-small'}
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => chooseStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="state-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading review history…
        </div>
      )}
      {!loading && error && (
        <div className="state-card state-card-error" role="alert">
          <strong>Review history could not be loaded</strong>
          <span>{error}</span>
          <button className="button button-outline button-small" type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && reports.length === 0 && (
        <div className="state-card state-card-empty">
          <span className="empty-mark" aria-hidden="true">○</span>
          <strong>No {status === 'ALL' ? 'reviewed' : status.toLowerCase()} reports</strong>
          <span>Reports you review will appear here.</span>
        </div>
      )}
      {!loading && !error && reports.length > 0 && (
        <>
          <div className="report-list">
            {reports.map((report) => (
              <article className="data-card report-card" key={report.id}>
                <div className="report-card-heading">
                  <div className="pending-report-heading">
                    <p className="eyebrow">REVIEWED REPORT</p>
                    <h2>{report.area.name}</h2>
                    <p className="muted-copy">{report.area.district.name}</p>
                  </div>
                  <span className={`report-status status-${report.status.toLowerCase()}`}>
                    {report.status.toLowerCase()}
                  </span>
                </div>

                <dl className="pending-report-meta">
                  <div>
                    <dt>Report ID</dt>
                    <dd>{report.id}</dd>
                  </div>
                  <div>
                    <dt>Hospital</dt>
                    <dd>{report.hospital?.name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatReportDate(report.reportedAt)}</dd>
                  </div>
                  <div>
                    <dt>Reviewed</dt>
                    <dd>{formatReportDate(report.reviewedAt)}</dd>
                  </div>
                </dl>

                <ul className="report-disease-list">
                  {report.lines.map((line) => (
                    <li key={line.id}>
                      <span>{line.disease.name}</span>
                      <strong>{line.caseCount.toLocaleString()} cases</strong>
                    </li>
                  ))}
                </ul>

                <div className="review-notes">
                  <strong>Review notes</strong>
                  <p>{report.reviewNotes || 'No review notes were left.'}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination-row" aria-label="Review history pages">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} reports
            </span>
            <div>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => loadPage(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => loadPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages || loading}
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

export default MedicalOfficerHistoryPage
