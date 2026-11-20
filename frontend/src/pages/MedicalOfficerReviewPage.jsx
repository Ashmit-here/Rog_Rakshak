import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

const PAGE_SIZE = 10
const MAX_PAGE = 1_000_000

function getPageHint() {
  const page = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isSafeInteger(page) && page > 0 && page <= MAX_PAGE ? page : 1
}

function formatReportDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

async function findPendingReport(reportId, pageHint, signal) {
  const firstPage = await apiRequest(
    `/reports/pending?page=${pageHint}&limit=${PAGE_SIZE}`,
    { signal },
  )
  const selectedReport = firstPage.reports.find(({ id }) => id === reportId)
  if (selectedReport) return selectedReport

  for (let page = 1; page <= firstPage.pagination.totalPages; page += 1) {
    if (page === pageHint) continue
    const result = await apiRequest(
      `/reports/pending?page=${page}&limit=${PAGE_SIZE}`,
      { signal },
    )
    const report = result.reports.find(({ id }) => id === reportId)
    if (report) return report
  }

  return null
}

function MedicalOfficerReviewPage({ reportId, navigate }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(Boolean(reportId))
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(reportId === '')
  const [refreshKey, setRefreshKey] = useState(0)
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const pageHint = getPageHint()

  useEffect(() => {
    if (!reportId) return undefined

    const controller = new AbortController()
    findPendingReport(reportId, pageHint, controller.signal)
      .then((result) => {
        if (result) {
          setReport(result)
        } else {
          setNotFound(true)
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [pageHint, refreshKey, reportId])

  function retryLoad() {
    setLoading(true)
    setLoadError('')
    setRefreshKey((value) => value + 1)
  }

  async function submitReview(status) {
    setSubmitting(true)
    setSubmitError('')

    try {
      await apiRequest(`/reports/${encodeURIComponent(report.id)}/review`, {
        method: 'PATCH',
        body: {
          status,
          ...(reviewNotes.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
        },
      })
      navigate('/medical-officer/pending', {
        state: { reviewMessage: `Report ${status.toLowerCase()} successfully.` },
      })
    } catch (error) {
      if (error.status === 409) {
        setAlreadyReviewed(true)
      } else if (error.status === 404) {
        setNotFound(true)
      } else {
        setSubmitError(error.message || 'Unable to review this report. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="workspace-content report-workspace">
      <button className="back-link" type="button" onClick={() => navigate('/medical-officer/pending')}>
        <span aria-hidden="true">←</span> Back to pending reports
      </button>
      <p className="eyebrow">MEDICAL OFFICER WORKSPACE</p>
      <h1>Review report</h1>
      <p className="workspace-lead">
        Review the report details before verifying or rejecting it.
      </p>

      {reportId === null && (
        <div className="state-card state-card-empty">
          <strong>Select a pending report to review</strong>
          <span>Choose a report from your assigned areas to see its details and review options.</span>
          <button
            className="button button-outline button-small"
            type="button"
            onClick={() => navigate('/medical-officer/pending')}
          >
            View pending reports
          </button>
        </div>
      )}
      {loading && (
        <div className="state-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading report details…
        </div>
      )}
      {!loading && loadError && (
        <div className="state-card state-card-error" role="alert">
          <strong>Report details could not be loaded</strong>
          <span>{loadError}</span>
          <button className="button button-outline button-small" type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}
      {!loading && notFound && (
        <div className="state-card state-card-empty" role="status">
          <strong>Report is no longer available for review</strong>
          <span>
            It may be missing, already reviewed, or outside your assigned areas.
          </span>
          <button
            className="button button-outline button-small"
            type="button"
            onClick={() => navigate('/medical-officer/pending')}
          >
            Return to pending reports
          </button>
        </div>
      )}
      {report && (
        <article className="data-card report-card">
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
            <div>
              <dt>Report ID</dt>
              <dd>{report.id}</dd>
            </div>
          </dl>

          <ul className="report-disease-list review-disease-list">
            {report.lines.map((line) => (
              <li key={line.id}>
                <div>
                  <span>{line.disease.name}</span>
                  <div className="review-notes">
                    <strong>Report notes</strong>
                    <p>{line.notes || 'No report notes provided.'}</p>
                  </div>
                </div>
                <strong>{line.caseCount.toLocaleString()} cases</strong>
              </li>
            ))}
          </ul>

          {alreadyReviewed && (
            <div className="form-message form-message-error review-success" role="status">
              This report has already been reviewed and cannot be changed.
            </div>
          )}
          {!alreadyReviewed && !notFound && (
            <div className="review-action-panel">
              <label className="form-field">
                <span>Review notes (optional)</span>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => {
                    setReviewNotes(event.target.value)
                    setSubmitError('')
                  }}
                  maxLength="2000"
                  rows="3"
                  disabled={submitting}
                />
              </label>
              {submitError && (
                <p className="form-message form-message-error" role="alert">
                  {submitError}
                </p>
              )}
              <div className="review-action-buttons">
                <button
                  className="button button-primary button-small"
                  type="button"
                  onClick={() => submitReview('VERIFIED')}
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : 'Verify'}
                </button>
                <button
                  className="button button-review-reject button-small"
                  type="button"
                  onClick={() => submitReview('REJECTED')}
                  disabled={submitting}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  )
}

export default MedicalOfficerReviewPage
