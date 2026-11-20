const rolePages = {
  HOSPITAL: {
    title: 'Hospital workspace',
    description: 'Submit community-level reports and follow the reports associated with your hospital.',
    links: [
      {
        path: '/hospital/reports',
        title: 'Report submission',
        description: 'Prepare a disease report for an area in your hospital district.',
        icon: '+',
      },
      {
        path: '/hospital/mine',
        title: 'My reports',
        description: 'Review the status of reports submitted through your hospital.',
        icon: '≡',
      },
    ],
  },
  MEDICAL_OFFICER: {
    title: 'Medical Officer workspace',
    description: 'Review pending reports for the areas assigned to your Medical Office.',
    links: [
      {
        path: '/medical-officer/pending',
        title: 'Pending reports',
        description: 'View reports awaiting review in your assigned areas.',
        icon: '◷',
      },
      {
        path: '/medical-officer/review',
        title: 'Review reports',
        description: 'Verify or reject a report after reviewing its details.',
        icon: '✓',
      },
      {
        path: '/medical-officer/history',
        title: 'Review history',
        description: 'View reports you have verified or rejected.',
        icon: '≡',
      },
    ],
  },
  ADMIN: {
    title: 'Administration',
    description: 'A central workspace for maintaining the Rog Rakshak platform.',
    links: [
      {
        path: '/admin',
        title: 'Management dashboard',
        description: 'Administration tools will be introduced in a later milestone.',
        icon: '◇',
      },
    ],
  },
}

function RoleDashboard({ role, path, navigate }) {
  const page = rolePages[role]
  if (!page) return null

  if (path === '/admin') {
    return (
      <section className="workspace-content">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>{page.title}</h1>
        <p className="workspace-lead">{page.description}</p>
        <div className="placeholder-card">
          <span className="placeholder-icon" aria-hidden="true">◇</span>
          <div>
            <h2>Management tools are coming next</h2>
            <p>This milestone establishes secure sign-in and role-based access. No management actions are available yet.</p>
          </div>
        </div>
      </section>
    )
  }

  const selectedLink = page.links.find((link) => link.path === path)
  if (selectedLink) {
    return (
      <section className="workspace-content">
        <button className="back-link" type="button" onClick={() => navigate(role === 'HOSPITAL' ? '/hospital' : '/medical-officer')}>
          <span aria-hidden="true">←</span> Back to workspace
        </button>
        <p className="eyebrow">{role === 'HOSPITAL' ? 'HOSPITAL WORKSPACE' : 'MEDICAL OFFICER WORKSPACE'}</p>
        <h1>{selectedLink.title}</h1>
        <p className="workspace-lead">{selectedLink.description}</p>
        <div className="placeholder-card">
          <span className="placeholder-icon" aria-hidden="true">{selectedLink.icon}</span>
          <div>
            <h2>This workflow has its own milestone</h2>
            <p>
              Your account is verified and this section is role-protected.
              The full report interface will be added separately.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="workspace-content">
      <p className="eyebrow">{role === 'HOSPITAL' ? 'HOSPITAL WORKSPACE' : 'MEDICAL OFFICER WORKSPACE'}</p>
      <h1>{page.title}</h1>
      <p className="workspace-lead">{page.description}</p>
      <div className="workspace-card-grid">
        {page.links.map((link) => (
          <button
            className="workspace-card"
            key={link.path}
            type="button"
            onClick={() => navigate(link.path)}
          >
            <span className="workspace-card-icon" aria-hidden="true">{link.icon}</span>
            <span className="workspace-card-copy">
              <strong>{link.title}</strong>
              <span>{link.description}</span>
            </span>
            <span className="workspace-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      <p className="workspace-note">
        Your account role and access are verified by the Rog Rakshak API.
      </p>
    </section>
  )
}

export default RoleDashboard
