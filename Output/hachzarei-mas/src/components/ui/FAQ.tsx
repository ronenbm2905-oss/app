interface Props {
  items: Array<{ question: string; answer: string }>;
}

/**
 * אקורדיון על <details>/<summary> — נגיש במקלדת ובקורא מסך מהדפדפן עצמו,
 * בלי ARIA ידני ובלי JavaScript.
 */
export function FAQ({ items }: Props) {
  return (
    <section aria-labelledby="faq-title" className="mx-auto w-full max-w-2xl px-5 py-12">
      <h2 id="faq-title" className="mb-6 text-2xl font-bold">
        שאלות נפוצות
      </h2>
      <div className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {item.question}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 fill-muted transition-transform group-open:rotate-180"
              >
                <path d="M10 13 4 7l1.4-1.4L10 10.2l4.6-4.6L16 7z" />
              </svg>
            </summary>
            <p className="pt-3 leading-relaxed text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
