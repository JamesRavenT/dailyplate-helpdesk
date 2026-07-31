import { describe, expect, test } from 'bun:test'
import { stripEmailQuotes, stripHtml } from './webhooks.ts'

describe('stripEmailQuotes', () => {
  test('removes a wrapped Gmail attribution and quoted reply', () => {
    const body = `Thanks, that fixed it.

On Fri, Jul 31, 2026 at 3:39 PM DailyPlate Support contact@dailyplate.help
wrote:
> Please try signing in again.`

    expect(stripEmailQuotes(body)).toBe('Thanks, that fixed it.')
  })

  test('removes a single-line attribution', () => {
    expect(stripEmailQuotes('New reply\n\nOn Fri, Jul 31, 2026 at 3:39 PM Support wrote:\nOld reply')).toBe(
      'New reply',
    )
  })

  test('removes a greater-than quoted block', () => {
    expect(stripEmailQuotes('New reply\n\n> Old reply\n> More old text')).toBe('New reply')
  })

  test('removes an Original Message section', () => {
    expect(stripEmailQuotes('New reply\n\n----Original Message----\nOld reply')).toBe('New reply')
  })

  test('does not truncate ordinary text containing the word on', () => {
    const body = 'I turned it on this morning.\nThe issue is still happening.'
    expect(stripEmailQuotes(body)).toBe(body)
  })
})

describe('stripHtml', () => {
  test('converts br and paragraph endings to newlines', () => {
    expect(stripHtml('<p>First line<br>Second line</p><p>Third line</p>')).toBe(
      'First line\nSecond line\nThird line',
    )
  })

  test('removes blockquote content', () => {
    expect(stripHtml('<p>New reply</p><blockquote><p>Quoted reply</p></blockquote>')).toBe('New reply')
  })

  test('removes Gmail and Outlook quote wrappers', () => {
    const html = '<div>New reply</div><div class="gmail_quote">Gmail quote</div><div id="appendonsend">Outlook quote</div>'
    expect(stripHtml(html)).toBe('New reply')
  })

  test('removes a nested Gmail reply quote', () => {
    const html = `
      <div>Here is the new reply.</div>
      <div class="gmail_quote">
        <div class="gmail_attr">On Fri, Jul 31, 2026 at 3:39 PM Support wrote:</div>
        <blockquote class="gmail_quote">
          <div>Original message</div>
          <div><div>Nested original content</div></div>
        </blockquote>
      </div>
    `

    expect(stripHtml(html)).toBe('Here is the new reply.')
  })

  test('decodes common and numeric HTML entities', () => {
    expect(stripHtml('<p>&amp; &lt; &gt; &quot; &#39; &nbsp; &#65;</p>')).toBe('& < > " \' A')
  })

  test('preserves line structure for quote stripping', () => {
    const html = '<div>New reply</div><div>On Fri, Jul 31, 2026 at 3:39 PM Support</div><div>wrote:</div><div>Old reply</div>'
    const text = stripHtml(html)

    expect(text).toContain('\n')
    expect(stripEmailQuotes(text)).toBe('New reply')
  })
})
