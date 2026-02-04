import { UserMenu } from "./user-menu";
import type { SessionUser } from "@/types/auth";

interface HeaderProps {
  user: SessionUser;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-end border-b bg-white px-6">
      <UserMenu user={user} />
    </header>
  );
}
