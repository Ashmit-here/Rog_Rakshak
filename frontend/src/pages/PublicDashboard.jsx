import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client'

function sumCases(entries) {
  return entries.reduce((total, entry) => total + (Number(entry.totalCaseCount) || 0), 0)
}

function PublicDashboard() {
  const [availableStatistics, setAvailableStatistics] = useState(null)
  const [statistics, setStatistics] = useState([])
  const [areaId, setAreaId] = useState('')
  const [diseaseId, setDiseaseId] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [statisticsError, setStatisticsError] = useState('')
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [statisticsLoading, setStatisticsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/public/statistics', { authenticated: false, signal: controller.signal })
      .then(({ statistics: rows }) => {
        setAvailableStatistics(rows)
        setOptionsError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setOptionsError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (availableStatistics === null) return undefined
    if (!areaId && !diseaseId) {
      setStatistics(availableStatistics)
      setStatisticsError('')
      setStatisticsLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const query = new URLSearchParams()
    if (areaId) query.set('areaId', areaId)
    if (diseaseId) query.set('diseaseId', diseaseId)
    setStatisticsLoading(true)

    apiRequest(`/public/statistics?${query}`, { authenticated: false, signal: controller.signal })
      .then(({ statistics: rows }) => {
        setStatistics(rows)
        setStatisticsError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatisticsError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatisticsLoading(false)
      })
    return () => controller.abort()
  }, [availableStatistics, areaId, diseaseId])

  const diseases = useMemo(() => {
    const uniqueDiseases = new Map()
    for (const entry of availableStatistics || []) {
      uniqueDiseases.set(entry.disease.id, entry.disease.name)
    }
    return [...uniqueDiseases].map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [availableStatistics])

  const areas = useMemo(() => {
    const uniqueAreas = new Map()
    for (const entry of availableStatistics || []) {
      uniqueAreas.set(entry.area.id, entry.area.name)
    }
    return [...uniqueAreas].map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [availableStatistics])

  const diseaseTotals = useMemo(() => {
    const totals = new Map()
    for (const entry of statistics) {
      const current = totals.get(entry.disease.id) || {
        id: entry.disease.id,
        name: entry.disease.name,
        totalCaseCount: 0,
      }
      current.totalCaseCount += Number(entry.totalCaseCount) || 0
      totals.set(entry.disease.id, current)
    }
    return [...totals.values()].sort((left, right) => right.totalCaseCount - left.totalCaseCount)
  }, [statistics])

  const totalCases = sumCases(statistics)
  const maxDiseaseCases = Math.max(1, ...diseaseTotals.map(({ totalCaseCount }) => totalCaseCount))

  return (
    <>
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="eyebrow eyebrow-light"><span /> COMMUNITY HEALTH, IN FOCUS</p>
          <h1>Understand health trends.<br /><span>Strengthen communities.</span></h1>
          <p>
            Explore verified disease reports summarized by disease and area.
            This public view contains aggregate counts only.
          </p>
          <a className="button button-light" href="#statistics">
            Explore verified data <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-assurance" aria-label="Statistics show verified reports only">
          <span className="assurance-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Verified reports only</strong>
            <span>Reviewed by an assigned Medical Officer</span>
          </div>
        </div>
      </section>

      <section className="statistics-section" id="statistics">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">PUBLIC HEALTH SNAPSHOT</p>
            <h2>Verified case statistics</h2>
            <p className="muted-copy">Totals include only reports marked verified.</p>
          </div>
          <span className="verified-badge"><span aria-hidden="true">✓</span> Verified data</span>
        </div>

        <div className="filter-bar" aria-label="Statistics filters">
          <label className="filter-field">
            <span>Area</span>
            <select
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              disabled={optionsLoading || Boolean(optionsError)}
            >
              <option value="">All areas</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Disease</span>
            <select
              value={diseaseId}
              onChange={(event) => setDiseaseId(event.target.value)}
              disabled={optionsLoading || Boolean(optionsError)}
            >
              <option value="">All diseases</option>
              {diseases.map((disease) => <option key={disease.id} value={disease.id}>{disease.name}</option>)}
            </select>
          </label>
          {(areaId || diseaseId) && (
            <button
              className="button button-secondary clear-filters"
              type="button"
              onClick={() => {
                setAreaId('')
                setDiseaseId('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {optionsLoading && <div className="state-card" role="status">Loading verified statistics…</div>}
        {!optionsLoading && optionsError && (
          <div className="state-card state-card-error" role="alert">
            <strong>Statistics are unavailable</strong>
            <span>{optionsError}</span>
          </div>
        )}
        {!optionsLoading && !optionsError && (
          <>
            <div className="stat-total-card">
              <div className="stat-total-icon" aria-hidden="true">+</div>
              <div>
                <span>Total verified cases</span>
                <strong>{statisticsLoading ? '—' : totalCases.toLocaleString()}</strong>
              </div>
              <span className="stat-total-context">
                {areaId || diseaseId ? 'Matching selected filters' : 'Across all reported areas'}
              </span>
            </div>

            {statisticsError && (
              <div className="state-card state-card-error" role="alert">{statisticsError}</div>
            )}
            {statisticsLoading && <div className="state-card" role="status">Updating statistics…</div>}
            {!statisticsLoading && !statisticsError && statistics.length === 0 && (
              <div className="state-card state-card-empty">
                <span className="empty-mark" aria-hidden="true">○</span>
                <strong>No verified statistics for this selection</strong>
                <span>Try another filter or check back when reports have been reviewed.</span>
              </div>
            )}
            {!statisticsLoading && !statisticsError && statistics.length > 0 && (
              <div className="statistics-grid">
                <section className="data-card disease-card">
                  <div className="data-card-heading">
                    <div>
                      <p className="eyebrow">BY DISEASE</p>
                      <h3>Disease-wise cases</h3>
                    </div>
                    <span className="card-icon" aria-hidden="true">⌁</span>
                  </div>
                  <div className="disease-list">
                    {diseaseTotals.map((disease) => (
                      <div className="disease-row" key={disease.id}>
                        <div className="disease-row-label">
                          <span>{disease.name}</span>
                          <strong>{disease.totalCaseCount.toLocaleString()}</strong>
                        </div>
                        <div className="bar-track" aria-label={`${disease.name}: ${disease.totalCaseCount} cases`}>
                          <span style={{ width: `${(disease.totalCaseCount / maxDiseaseCases) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="card-footnote">Case totals are grouped from verified report lines.</p>
                </section>

                <section className="data-card area-card">
                  <div className="data-card-heading">
                    <div>
                      <p className="eyebrow">BY AREA</p>
                      <h3>Area-wise disease cases</h3>
                    </div>
                    <span className="card-icon" aria-hidden="true">⌖</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th scope="col">Area</th><th scope="col">Disease</th><th scope="col">Verified cases</th></tr>
                      </thead>
                      <tbody>
                        {statistics.map((entry) => (
                          <tr key={`${entry.area.id}-${entry.disease.id}`}>
                            <td>{entry.area.name}</td>
                            <td>{entry.disease.name}</td>
                            <td>{Number(entry.totalCaseCount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </section>

      <section className="public-principles" id="about">
        <div className="principle-heading">
          <p className="eyebrow">A RESPONSIBLE VIEW</p>
          <h2>Useful summaries, without personal records.</h2>
          <p>
            Public statistics show reviewed aggregate counts. Individual
            reports and personal details are never displayed here.
          </p>
        </div>
        <div className="principle-grid">
          <article className="principle-card">
            <span>01</span>
            <h3>Verified before sharing</h3>
            <p>Only reports reviewed by a Medical Officer contribute to public totals.</p>
          </article>
          <article className="principle-card">
            <span>02</span>
            <h3>Grouped by place and disease</h3>
            <p>Filters help explore area-level trends without exposing report records.</p>
          </article>
          <article className="principle-card">
            <span>03</span>
            <h3>People-first information</h3>
            <p>Patient identities and submitter details are not part of this dashboard.</p>
          </article>
        </div>
      </section>
    </>
  )
}

export default PublicDashboard
