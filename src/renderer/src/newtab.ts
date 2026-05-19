const form = document.getElementById('search-form') as HTMLFormElement | null
const input = document.getElementById('search-input') as HTMLInputElement | null

if (form && input) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const query = input.value.trim()
    if (!query) return
    const url = query.includes('.') && !query.includes(' ')
      ? `https://${query}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.location.href = url
  })
}
