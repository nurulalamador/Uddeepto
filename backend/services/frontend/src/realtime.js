import { verifySocketTicket, query } from "@uddeepto/common";
export const realtimeOptions = {
  origins: (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(origin => origin.trim()).filter(Boolean),
  authenticate: async ticket => {
    const payload = verifySocketTicket(ticket);
    const u = (await query("SELECT id,name,role,account_status FROM users WHERE id=$1", [payload.sub])).rows[0];
    return u && u.account_status === "active" ? {
      id: u.id,
      name: u.name,
      role: u.role
    } : null;
  },
  conversationMembers: async id => (await query("SELECT user_id FROM conversation_members WHERE conversation_id=$1", [id])).rows.map(row => row.user_id),
  isCommunityMember: async (user, id) => (await query(`SELECT 1 FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$2 WHERE c.id=$1 AND(m.status='approved' OR c.creator_id=$2 OR $3='admin')`, [id, user.id, user.role])).rowCount > 0,
  activeUsers: async ids => (await query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND account_status='active'", [ids])).rows.map(row => row.id)
};
