import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

const PAGE_SIZE = 10

function formatReportDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function MedicalOfficerPendingPage({ navigate }) {
  const [reports, setReports] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [successMessage, setSuccessMessage] = useState(() => (
    typeof window.history.state?.reviewMessage === 'string'
      ? window.history.state.reviewMessage
      : ''
  ))

  useEffect(() => {
    if (window.history.state?.reviewMessage) {
      window.history.replaceState({}, '', window.location.href)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/reports/pending?page=${page}&limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then(({ reports: rows, pagination: pageInfo }) => {
        setReports(rows)
        setPagination(pageInfo)
        setLoadError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, refreshKey])

  function loadPage(nextPage) {
    setLoading(true)
    setLoadError('')
    setSuccessMessage('')
    setPage(nextPage)
  }

  function retryLoad() {
    setLoading(true)
    setLoadError('')
    setRefreshKey((value) => value + 1)
  }

  function openReview(reportId) {
    navigate(`/medical-officer/review/${encodeURIComponent(reportId)}?page=${page}`)
  }

  return (
    <section className="workspace-content report-workspace">
      <button className="back-link" type="button" onClick={() => navigate('/medical-officer')}>
        <span aria-hidden="true">←</span> Back to workspace
      </button>
      <p className="eyebrow">MEDICAL OFFICER WORKSPACE</p>
      <h1>Pending reports</h1>
      <p className="workspace-lead">
        Review reports submitted for areas assigned to your Medical Office.
      </p>

      {successMessage && (
        <div className="form-message form-message-success review-success" role="status">
          {successMessage}
        </div>
      )}
      {loading && (
        <div className="state-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading pending reports…
        </div>
      )}
      {!loading && loadError && (
        <div className="state-card state-card-error" role="alert">
          <strong>Pending reports could not be loaded</strong>
          <span>{loadError}</span>
          <button className="button button-outline button-small" type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}
      {!loading && !loadError && reports.length === 0 && (
        <div className="state-card state-card-empty">
          <span className="empty-mark" aria-hidden="true">○</span>
          <strong>No pending reports</strong>
          <span>Reports awaiting your review will appear here.</span>
        </div>
      )}
      {!loading && !loadError && reports.length > 0 && (
        <>
          <div className="report-list">
            {reports.map((report) => (
              <article className="data-card report-card" key={report.id}>
                <div className="report-card-heading">
                  <div className="pending-report-heading">
                    <p className="eyebrow">PENDING REPORT</p>
                    <h2>{report.area.name}</h2>
                    <p className="muted-copy">{report.area.district.name}</p>
                  </div>
                  <span className="report-status">Pending</span>
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
                    <dt>Report date</dt>
                    <dd>{formatReportDate(report.reportedAt)}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatReportDate(report.createdAt)}</dd>
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

                <div className="pending-report-review">
                  <button
                    className="button button-outline button-small"
                    type="button"
                    onClick={() => openReview(report.id)}
                  >
                    Review
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination-row" aria-label="Pending report pages">
            <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} reports</span>
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

export default MedicalOfficerPendingPage
