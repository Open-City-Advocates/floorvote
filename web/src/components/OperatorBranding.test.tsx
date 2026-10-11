import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OperatorBranding } from './OperatorBranding'
import { ConfigContext, type AppConfig } from '../context/ConfigContext'
import { SOURCE_URL, LICENSE_URL } from '../../../shared/brand'
import type { ProviderCredit } from '../../../shared/dataAttribution'

const full = { name: 'Example Org', url: 'https://example.org/elections', contactEmails: ['ops@example.org'] }

function renderBranding(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('OperatorBranding', () => {
  it('shows logo + name in the operator link once the logo loads', () => {
    renderBranding(<OperatorBranding operator={full} />)
    const img = screen.getByAltText('Example Org')
    fireEvent.load(img)
    const link = screen.getByRole('link', { name: /Example Org/i })
    expect(link).toHaveAttribute('href', 'https://example.org/elections')
    expect(screen.getByText('Example Org')).toBeInTheDocument()
    expect(img).toBeVisible()
  })

  it('renders the credit unlinked when url is empty', () => {
    renderBranding(<OperatorBranding operator={{ ...full, url: '' }} />)
    fireEvent.load(screen.getByAltText('Example Org'))
    expect(screen.queryByRole('link', { name: /Example Org/i })).toBeNull()
    expect(screen.getByText('Example Org')).toBeInTheDocument()
  })

  it('keeps the name and drops the img when the logo fails to load', () => {
    renderBranding(<OperatorBranding operator={full} />)
    fireEvent.error(screen.getByAltText('Example Org'))
    expect(screen.queryByAltText('Example Org')).toBeNull()
    expect(screen.getByText('Example Org')).toBeInTheDocument()
  })

  it('collapses the operator credit when the logo fails and there is no name', () => {
    renderBranding(<OperatorBranding operator={{ name: '', url: '', contactEmails: [] }} sourceUrl="" />)
    fireEvent.error(screen.getByAltText('FloorVote')) // alt falls back to PRODUCT_NAME
    expect(screen.queryByAltText('FloorVote')).toBeNull()
    // Credit collapsed: no operator link; the always-on Data attribution remains.
    expect(screen.getByRole('link', { name: 'LegiScan' })).toBeInTheDocument()
  })

  it('always renders the LegiScan / CC BY data attribution', () => {
    renderBranding(<OperatorBranding operator={{ name: '', url: '', contactEmails: [] }} />)
    expect(screen.getByRole('link', { name: 'LegiScan' })).toHaveAttribute('href', 'https://legiscan.com')
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument()
  })

  // Suppression drops the source *link*, never the license notice: AGPL §5 asks
  // that legal notices be preserved, so config can withhold a URL the operator
  // does not have but cannot silently strip the attribution.
  it('keeps the license notice but drops the link when the source URL is empty', () => {
    renderBranding(<OperatorBranding operator={full} sourceUrl="" />)
    expect(screen.queryByRole('link', { name: 'FloorVote' })).toBeNull()
    expect(screen.getByRole('link', { name: 'AGPLv3' })).toBeInTheDocument()
    expect(screen.queryByText(/^Source:/)).toBeNull()
  })

  it('renders Source: <product> (AGPLv3) with the repo link when configured', () => {
    renderBranding(<OperatorBranding operator={full} sourceUrl="https://github.com/floorvote/floorvote" />)
    expect(screen.getByRole('link', { name: 'FloorVote' }))
      .toHaveAttribute('href', 'https://github.com/floorvote/floorvote')
    expect(screen.getByText(/Source:/)).toBeInTheDocument()
  })

  // The license link used to be built as `${sourceUrl}/blob/main/LICENSE` — GitHub's
  // URL shape with a `main` default branch, which 404s the moment an operator points
  // the source anywhere else. The license text lives at a canonical, invariant
  // address instead, because AGPLv3 is a property of the work, not of the operator.
  it('links the license to its canonical address, never one derived from the source', () => {
    renderBranding(<OperatorBranding operator={full} sourceUrl="https://gitlab.com/org/fork" />)
    expect(screen.getByRole('link', { name: 'AGPLv3' })).toHaveAttribute('href', LICENSE_URL)
    expect(LICENSE_URL).toContain('gnu.org')
    for (const a of screen.getAllByRole('link')) {
      expect(a.getAttribute('href')).not.toContain('blob/main/LICENSE')
    }
  })

  // The license link is invariant, so it survives suppression of the source link.
  it('keeps the license link even when the source URL is suppressed', () => {
    renderBranding(<OperatorBranding operator={full} sourceUrl="" />)
    expect(screen.getByRole('link', { name: 'AGPLv3' })).toHaveAttribute('href', LICENSE_URL)
  })

  // Precedence: explicit prop → operator config → the built-in constant. The
  // constant is the truthful default for an unmodified deployment; an operator
  // running modified code overrides it with their own published source.
  it('prefers the operator config source URL over the built-in constant', () => {
    renderBranding(<OperatorBranding operator={{ ...full, sourceUrl: 'https://gitea.example/org/fork' }} />)
    expect(screen.getByRole('link', { name: 'FloorVote' }))
      .toHaveAttribute('href', 'https://gitea.example/org/fork')
  })

  it('treats an explicitly empty operator config URL as suppression, not as unset', () => {
    renderBranding(<OperatorBranding operator={{ ...full, sourceUrl: '' }} />)
    expect(screen.queryByRole('link', { name: 'FloorVote' })).toBeNull()
    expect(screen.getByRole('link', { name: 'AGPLv3' })).toBeInTheDocument()
  })

  // One sentence per license, on the license link itself — no ⓘ, no contacts, no
  // actions. "AGPLv3" and "CC BY 4.0" are opaque to most readers, and the license
  // text explains the terms to a lawyer rather than the entitlement to a member.
  it('explains the software license in a tooltip on the license link', async () => {
    renderBranding(<OperatorBranding operator={full} />)
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'AGPLv3' }))
    expect(await screen.findByText(/entitled to the source code of the version they are being served/i))
      .toBeInTheDocument()
  })

  it('explains the data license in a tooltip on the CC BY link', async () => {
    renderBranding(<OperatorBranding operator={full} />)
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'CC BY 4.0' }))
    expect(await screen.findByText(/allows anyone to reuse it with credit/i)).toBeInTheDocument()
  })

  // The hover bubble is aria-hidden in this archetype, so without a described-by
  // copy the sentence would reach sighted users only — and its whole purpose is
  // telling people what they are entitled to.
  it('exposes both notes to screen readers, not just on hover', () => {
    renderBranding(<OperatorBranding operator={full} />)
    for (const [name, text] of [
      ['AGPLv3', /free software licensed under the AGPLv3/i],
      ['CC BY 4.0', /Creative Commons Attribution 4.0/i],
    ] as const) {
      const id = screen.getByRole('link', { name }).getAttribute('aria-describedby')
      expect(id).toBeTruthy()
      expect(document.getElementById(id!)).toHaveTextContent(text)
    }
  })

  it('carries no info-icon button and no contact plumbing', () => {
    renderBranding(<OperatorBranding operator={full} />)
    expect(screen.queryByRole('button', { name: /license/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /send a request/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /ops@example\.org/ })).toBeNull()
  })

  // Guards the SOURCE_URL constant itself: every other source-line case passes
  // `sourceUrl` explicitly, so the suite stayed green while the constant was empty
  // and the footer shipped with no AGPLv3 §13 source offer.
  it('renders the source line from the SOURCE_URL default when no prop is given', () => {
    renderBranding(<OperatorBranding operator={full} />)
    expect(screen.getByRole('link', { name: 'FloorVote' })).toHaveAttribute('href', SOURCE_URL)
    expect(SOURCE_URL).toMatch(/^https:\/\/\S+[^/]$/)
  })

  it('renders both legal links with a separator when both docs exist', () => {
    renderBranding(<OperatorBranding operator={full} showTerms showPrivacy />)
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })

  it('opens each legal doc alongside the page rather than navigating away', () => {
    renderBranding(<OperatorBranding operator={full} showTerms showPrivacy />)
    for (const name of ['Terms', 'Privacy']) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })

  it('renders only the present legal link, no dangling separator', () => {
    renderBranding(<OperatorBranding operator={full} showTerms={false} showPrivacy />)
    expect(screen.queryByRole('link', { name: 'Terms' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument()
  })

  it('renders no legal line when neither doc exists', () => {
    renderBranding(<OperatorBranding operator={full} showTerms={false} showPrivacy={false} />)
    expect(screen.queryByRole('link', { name: 'Terms' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Privacy' })).toBeNull()
  })
})

describe('OperatorBranding data credit by provider', () => {
  const legiscan = { id: 'legiscan', name: 'LegiScan', url: 'https://legiscan.com', note: 'From LegiScan, CC BY.', license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } }
  const dc = { id: 'lims', name: 'DC Council LIMS', url: 'https://lims.dccouncil.gov', note: 'From the Council.' }
  // A provider no web code knows about: its credit is rendered from what config declares.
  const md = { id: 'mga', name: 'Maryland General Assembly', url: 'https://mgaleg.maryland.gov', note: 'From the General Assembly.' }

  // Through ConfigContext, as GET /config feeds it.
  function renderWithConfig(providers: ProviderCredit[] | undefined) {
    const config = { associationName: '', state: '', states: [], sessions: [], attribution: providers && { providers } } as unknown as AppConfig
    return render(
      <MemoryRouter>
        <ConfigContext.Provider value={{ config, multiState: false, loading: false }}>
          <OperatorBranding operator={{ name: '', url: '', contactEmails: [] }} />
        </ConfigContext.Provider>
      </MemoryRouter>,
    )
  }

  it('credits the DC Council LIMS, and not LegiScan, when central names only it', () => {
    renderWithConfig([dc])
    expect(screen.getByRole('link', { name: 'DC Council LIMS' })).toHaveAttribute('href', 'https://lims.dccouncil.gov')
    expect(screen.queryByRole('link', { name: 'LegiScan' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'CC BY 4.0' })).toBeNull()
  })

  it('credits every provider central names, with the license where a provider has one', () => {
    renderWithConfig([legiscan, dc])
    expect(screen.getByRole('link', { name: 'LegiScan' })).toHaveAttribute('href', 'https://legiscan.com')
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    expect(screen.getByRole('link', { name: 'DC Council LIMS' })).toBeInTheDocument()
  })

  it('credits a provider the web app has never heard of from its declaration alone', () => {
    renderWithConfig([md])
    expect(screen.getByRole('link', { name: 'Maryland General Assembly' })).toHaveAttribute('href', 'https://mgaleg.maryland.gov')
    expect(screen.getByText('From the General Assembly.')).toBeInTheDocument() // the screen-reader copy of the note
    expect(screen.queryByRole('link', { name: 'LegiScan' })).toBeNull()
  })

  it('makes a provider id safe to use as an element id, so the note still describes the link', () => {
    renderWithConfig([{ ...dc, id: 'li ms"x' }])
    const describedBy = screen.getByRole('link', { name: 'DC Council LIMS' }).getAttribute('aria-describedby')
    expect(describedBy).toBe('footer-data-note-li-ms-x')
    expect(document.getElementById(describedBy!)).toHaveTextContent('From the Council.')
  })

  it('credits LegiScan when the config carries no attribution, or none that names a provider', () => {
    const { unmount } = renderWithConfig(undefined)
    expect(screen.getByRole('link', { name: 'LegiScan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument()
    unmount()
    renderWithConfig([])
    expect(screen.getByRole('link', { name: 'LegiScan' })).toBeInTheDocument()
  })
})
