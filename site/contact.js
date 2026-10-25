// Modulo di contatto: manda i campi a Web3Forms, che li inoltra per email all'autore. L'oggetto comincia
// sempre con [STELLA]; la risposta va all'email di chi scrive (Web3Forms la usa come reply-to).
;(() => {
  const T = window.CONTACT_TEXTS
  const form = document.getElementById('contact-form')
  const status = document.getElementById('contact-status')
  const button = form.querySelector('button[type=submit]')
  const key = form.elements.access_key.value

  if (!key) {
    status.textContent = T.inactive
    button.disabled = true
    return
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!form.reportValidity()) return
    // campo trappola spuntato: è un programma, non una persona
    if (form.elements.botcheck.checked) return
    const f = form.elements
    const name = f.name.value.trim()
    const topic = f.topic.value.trim()
    const body = {
      access_key: key,
      from_name: f.from_name.value,
      subject: `[STELLA] ${topic || T.defaultSubject + ' ' + name}`,
      name,
      email: f.email.value.trim(),
      message: f.message.value.trim(),
      language: T.lang,
      botcheck: false
    }
    button.disabled = true
    status.className = 'contact-status'
    status.textContent = T.sending
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.message || res.status)
      form.reset()
      status.className = 'contact-status ok'
      status.textContent = T.ok
    } catch {
      status.className = 'contact-status error'
      status.textContent = T.error
    } finally {
      button.disabled = false
    }
  })
})()
