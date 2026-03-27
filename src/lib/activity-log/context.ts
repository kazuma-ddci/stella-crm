// AsyncLocalStorageによるユーザーID管理は廃止。
// logActivity呼び出し時にuserIdを直接渡す方式に変更。
// このファイルは互換性のために残しています。

export function getCurrentUserId(): number | null {
  return null;
}
