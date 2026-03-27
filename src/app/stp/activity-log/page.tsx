import { getActivityLogs, getLogTableNames, getLogStaffList } from "./actions";
import { ActivityLogClient } from "./activity-log-client";

export default async function ActivityLogPage() {
  const [initialData, tableNames, staffList] = await Promise.all([
    getActivityLogs(1, 50),
    getLogTableNames(),
    getLogStaffList(),
  ]);

  return (
    <ActivityLogClient
      initialData={initialData}
      tableNames={tableNames}
      staffList={staffList}
    />
  );
}
