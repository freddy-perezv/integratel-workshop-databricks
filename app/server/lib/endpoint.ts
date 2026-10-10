/**
 * Streaming text helpers.
 *
 * The Databricks serving-endpoints streaming gateway occasionally returns
 * UTF-8 bytes the HTTP layer then re-decodes as Latin-1, which looks like
 * mojibake to the user. Re-encode before forwarding deltas.
 */
export function fixMojibake(s: string): string {
  // Solo re-decodifica si el texto TIENE la firma del mojibake (Ã, Â, â€ seguidos de un byte
  // de continuación). Con modelos que ya entregan UTF-8 correcto (Claude vía Chat
  // Completions) re-decodificar siempre convertía "ó" en "�".
  if (!s || !/[ÃÂâ][\u0080-\u00BF]/.test(s)) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  return fixed.includes('\uFFFD') ? s : fixed;
}
