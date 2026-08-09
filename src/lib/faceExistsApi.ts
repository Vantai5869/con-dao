/**
 * Checks whether a face/identity record already exists for `idNumber` — used
 * on return trips to skip re-capturing documents.
 *
 * TODO: replace with a real backend verification API. For now this always
 * resolves true, per explicit instruction to default to "already exists"
 * until the real service is wired up.
 */
export async function checkFaceExists(idNumber: string): Promise<boolean> {
  void idNumber;
  return true;
}
