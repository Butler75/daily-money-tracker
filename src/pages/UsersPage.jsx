import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAppData } from "../context/AppDataContext";

export function UsersPage() {
  const {
    profile,
    profiles,
    staffInvites,
    updateUserRole,
    updateUserActive,
    inviteStaff,
    sendPasswordReset,
  } = useAppData();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  async function handleRoleChange(profileId, role) {
    try {
      setActionError("");
      await updateUserRole(profileId, role);
      setActionMessage("Role updated.");
    } catch (err) {
      setActionError(err.message || "Could not update role.");
    }
  }

  async function handleActiveChange(member, isActive) {
    try {
      setActionError("");
      await updateUserActive(member.id, isActive);
      setActionMessage(`User ${isActive ? "activated" : "deactivated"}.`);
    } catch (err) {
      setActionError(err.message || "Could not update user status.");
    }
  }

  async function handleInviteSubmit(event) {
    event.preventDefault();
    try {
      setActionError("");
      await inviteStaff({ email: inviteEmail, role: inviteRole });
      setActionMessage("Invite created.");
      setInviteEmail("");
      setInviteRole("staff");
    } catch (err) {
      setActionError(err.message || "Could not create invite.");
    }
  }

  async function handleResetPassword(email) {
    try {
      setActionError("");
      await sendPasswordReset(email);
      setActionMessage(`Password reset sent to ${email}.`);
    } catch (err) {
      setActionError(err.message || "Could not send password reset email.");
    }
  }

  return (
    <Layout title="Users / Staff" subtitle="Manage staff accounts and roles">
      <section className="card">
        <p className="text-sm text-slate-600">
          Logged in as <strong>{profile?.full_name || "Unnamed user"}</strong>
        </p>
        <p className="text-xs text-slate-500">Role: {profile?.role || "staff"}</p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Invite staff by email</h2>
        <form className="mt-3 grid grid-cols-1 gap-2" onSubmit={handleInviteSubmit}>
          <input
            className="input"
            type="email"
            placeholder="staff@example.com"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            required
          />
          <select
            className="input"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value)}
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="owner">Owner</option>
          </select>
          <button className="btn-primary" type="submit">
            Create Invite
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Pending invites</h2>
        <ul className="mt-3 space-y-2">
          {staffInvites.map((invite) => (
            <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{invite.email}</p>
              <p className="text-xs text-slate-500">
                Role {invite.role} | Status {invite.status}
              </p>
            </li>
          ))}
          {staffInvites.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">
              No invites.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Team members</h2>
        <ul className="mt-3 space-y-2">
          {profiles.map((member) => (
            <li key={member.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">
                    {member.full_name || "No name"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {member.id} | {member.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select
                    className="input max-w-[140px]"
                    value={member.role || "staff"}
                    onChange={(event) => handleRoleChange(member.id, event.target.value)}
                    disabled={member.id === profile?.id}
                  >
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-2 py-1 text-xs"
                      type="button"
                      onClick={() => handleActiveChange(member, !member.is_active)}
                      disabled={member.id === profile?.id}
                    >
                      {member.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="btn-secondary px-2 py-1 text-xs"
                      type="button"
                      onClick={() => handleResetPassword(member.email || "")}
                      disabled={!member.email}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {actionError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {actionError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
            {actionMessage}
          </p>
        ) : null}
      </section>
    </Layout>
  );
}
