import { useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../api/client'

function localDateValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function HospitalReportPage({ navigate }) {
  const nextEntryId = useRef(1)
  const [referenceData, setReferenceData] = useState({ areas: [], diseases: [] })
  const [referenceLoading, setReferenceLoading] = useState(true)
  const [referenceError, setReferenceError] = useState('')
  const [areaId, setAreaId] = useState('')
  const [reportedAt, setReportedAt] = useState(localDateValue)
  const [entries, setEntries] = useState([{ id: 0, diseaseId: '', caseCount: '', notes: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/public/reference-data', { authenticated: false, signal: controller.signal })
      .then(({ areas, diseases }) => {
        setReferenceData({ areas, diseases })
        setReferenceError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setReferenceError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setReferenceLoading(false)
      })
    return () => controller.abort()
  }, [])

  const selectedDiseaseIds = useMemo(
    () => new Set(entries.map(({ diseaseId }) => diseaseId).filter(Boolean)),
    [entries],
  )

  function updateEntry(id, field, value) {
    setEntries((current) => current.map((entry) => (
      entry.id === id ? { ...entry, [field]: value } : entry
    )))
    setSubmitError('')
    setSuccessMessage('')
  }

  function addEntry() {
    setEntries((current) => [...current, {
      id: nextEntryId.current++,
      diseaseId: '',
      caseCount: '',
      notes: '',
    }])
  }

  function removeEntry(id) {
    setEntries((current) => current.length > 1
      ? current.filter((entry) => entry.id !== id)
      : current)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    setSuccessMessage('')

    if (!areaId || !reportedAt || entries.some(({ diseaseId, caseCount }) => (
      !diseaseId || !Number.isSafeInteger(Number(caseCount)) ||
      Number(caseCount) < 1 || Number(caseCount) > 2_147_483_647
    ))) {
      setSubmitError('Choose an area and date, and enter a disease with a positive whole-number case count for every row.')
      return
    }

    setSubmitting(true)
    try {
      const { report } = await apiRequest('/reports', {
        method: 'POST',
        body: {
          areaId,
          reportedAt,
          diseases: entries.map(({ diseaseId, caseCount, notes }) => ({
            diseaseId,
            caseCount: Number(caseCount),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          })),
        },
      })
      setSuccessMessage(`Report submitted successfully. Status: ${report.status.toLowerCase()}.`)
    } catch (error) {
      setSubmitError(error.message || 'Unable to submit the report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasAvailableDiseases = referenceData.diseases.some(
    (disease) => !selectedDiseaseIds.has(disease.id),
  )
  const canAddEntry = hasAvailableDiseases && entries.length < referenceData.diseases.length

  return (
    <section className="workspace-content report-workspace">
      <button className="back-link" type="button" onClick={() => navigate('/hospital')}>
        <span aria-hidden="true">←</span> Back to workspace
      </button>
      <p className="eyebrow">HOSPITAL WORKSPACE</p>
      <h1>Submit a disease report</h1>
      <p className="workspace-lead">
        Enter case counts for an area in your hospital district. Submitted reports are sent for review.
      </p>

      {referenceLoading && (
        <div className="state-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Loading areas and diseases…
        </div>
      )}
      {!referenceLoading && referenceError && (
        <div className="state-card state-card-error" role="alert">
          <strong>Reference data is unavailable</strong>
          <span>{referenceError}</span>
        </div>
      )}
      {!referenceLoading && !referenceError && (
        <form className="data-card report-form" onSubmit={handleSubmit}>
          <div className="report-form-grid">
            <label className="form-field">
              <span>Area</span>
              <select
                value={areaId}
                onChange={(event) => {
                  setAreaId(event.target.value)
                  setSubmitError('')
                  setSuccessMessage('')
                }}
                required
                disabled={submitting || referenceData.areas.length === 0}
              >
                <option value="">Select an area</option>
                {referenceData.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} — {area.district.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Report date</span>
              <input
                type="date"
                value={reportedAt}
                onChange={(event) => {
                  setReportedAt(event.target.value)
                  setSubmitError('')
                  setSuccessMessage('')
                }}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <div className="report-section-heading">
            <div>
              <p className="eyebrow">REPORT DETAILS</p>
              <h2>Disease cases</h2>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={addEntry}
              disabled={submitting || !canAddEntry}
            >
              Add disease
            </button>
          </div>

          {referenceData.diseases.length === 0 && (
            <div className="state-card state-card-empty">
              <strong>No active diseases are available</strong>
              <span>Please contact your administrator before submitting.</span>
            </div>
          )}
          {referenceData.areas.length === 0 && (
            <div className="state-card state-card-empty">
              <strong>No areas are available</strong>
              <span>Please contact your administrator before submitting.</span>
            </div>
          )}

          <div className="report-entry-list">
            {entries.map((entry, index) => (
              <div className="report-entry" key={entry.id}>
                <div className="report-entry-heading">
                  <strong>Disease {index + 1}</strong>
                  {entries.length > 1 && (
                    <button
                      className="remove-entry-button"
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="report-form-grid">
                  <label className="form-field">
                    <span>Disease</span>
                    <select
                      value={entry.diseaseId}
                      onChange={(event) => updateEntry(entry.id, 'diseaseId', event.target.value)}
                      required
                      disabled={submitting || referenceData.diseases.length === 0}
                    >
                      <option value="">Select a disease</option>
                      {referenceData.diseases
                        .filter((disease) => (
                          disease.id === entry.diseaseId || !selectedDiseaseIds.has(disease.id)
                        ))
                        .map((disease) => (
                          <option key={disease.id} value={disease.id}>
                            {disease.name} ({disease.code})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Positive cases</span>
                    <input
                      type="number"
                      min="1"
                      max="2147483647"
                      step="1"
                      inputMode="numeric"
                      value={entry.caseCount}
                      onChange={(event) => updateEntry(entry.id, 'caseCount', event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>
                </div>
                <label className="form-field report-notes-field">
                  <span>Notes (optional)</span>
                  <textarea
                    value={entry.notes}
                    onChange={(event) => updateEntry(entry.id, 'notes', event.target.value)}
                    maxLength="2000"
                    rows="2"
                    disabled={submitting}
                  />
                </label>
              </div>
            ))}
          </div>

          {submitError && <p className="form-message form-message-error" role="alert">{submitError}</p>}
          {successMessage && (
            <div className="form-message form-message-success" role="status">
              <span>{successMessage}</span>
              <button className="text-button" type="button" onClick={() => navigate('/hospital/mine')}>
                View my reports
              </button>
            </div>
          )}

          <div className="report-submit-row">
            <p className="muted-copy">Your hospital and report status are assigned securely by the server.</p>
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting || referenceData.areas.length === 0 || referenceData.diseases.length === 0}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default HospitalReportPage
