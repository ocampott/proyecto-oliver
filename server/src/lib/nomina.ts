export function normalizeNombre(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function sameWords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}

function subsetWords(a: string[], b: string[]): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length > 0 && shorter.every((w) => longer.includes(w));
}

export function validarEmpleado(nombres: string[], input: string): string | null {
  const target = normalizeNombre(input);
  if (target.length === 0) return null;

  const exactas = nombres.filter((n) => sameWords(normalizeNombre(n), target));
  if (exactas.length === 1) return exactas[0];
  if (exactas.length > 1) return null;

  const parciales = nombres.filter((n) => subsetWords(normalizeNombre(n), target));
  if (parciales.length === 1) return parciales[0];
  return null;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function umbralPalabra(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

function palabrasParecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const umbral = Math.min(umbralPalabra(a.length), umbralPalabra(b.length));
  return levenshtein(a, b) <= umbral;
}

function subsetParecido(shorter: string[], longer: string[]): boolean {
  return shorter.length > 0 && shorter.every((w) => longer.some((lw) => palabrasParecidas(w, lw)));
}

export function buscarEmpleadoParecido(nombres: string[], input: string): string | null {
  const target = normalizeNombre(input);
  if (target.length === 0) return null;

  const candidatos = nombres.filter((n) => {
    const palabras = normalizeNombre(n);
    const [shorter, longer] = target.length <= palabras.length ? [target, palabras] : [palabras, target];
    return subsetParecido(shorter, longer);
  });

  if (candidatos.length === 1) return candidatos[0];
  return null;
}
