'use client';

export function Suppressed() {
  function report() {
    // architect-ignore-next-line
    alert('legacy — tracked in #42');
  }
  return <button onClick={report}>report</button>;
}
