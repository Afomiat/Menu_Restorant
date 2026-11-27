/** Shown inside a Finance section whose request failed; the other sections still show their numbers. */
export default function FinancePartFailed() {
  return (
    <p className="rpt-empty fin-part-failed" role="status">
      Couldn&apos;t load this part right now. The rest of the page is up to date.
    </p>
  );
}
