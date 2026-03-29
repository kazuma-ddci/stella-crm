import Link from "next/link";
import { MessageSquare } from "lucide-react";

const accounts = [
  { name: "申請サポートセンター", href: "/hojo/line-friends/shinsei-support" },
  { name: "一般社団法人助成金申請サポート", href: "/hojo/line-friends/josei-support" },
  { name: "ALKES", href: "/hojo/line-friends/alkes" },
  { name: "セキュリティクラウドサポート", href: "/hojo/line-friends/security-cloud" },
];

export default function HojoLineFriendsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">公式LINE友達情報</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <Link
            key={account.href}
            href={account.href}
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-green-600" />
            <span className="font-medium">{account.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
