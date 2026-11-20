"use client";

import { Copy, KeyRound, Plus, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { MenuItem, Select, type SelectOption } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatInstantTime, toIst } from "@/lib/time";
import type { StaffListItem } from "@/server/admin/staff-admin";
import type { TeamMember } from "@/server/admin/team";
import { adminFetch, RowActions, useMutation } from "./admin-kit";

const ROLE = { owner: "Owner", receptionist: "Front desk", staff: "Artist" } as const;
const ROLE_HINT = {
  owner: "Everything, including prices, settings and team logins.",
  receptionist: "Bookings, walk-ins, leave, closures and website content.",
  staff: "Their own schedule and leave requests at /staff. Link them to their artist profile. No admin access.",
} as const;
type Role = keyof typeof ROLE;
const ROLE_OPTIONS: SelectOption<Role>[] = (["receptionist", "owner", "staff"] as const).map((r) => ({ value: r, label: ROLE[r] }));

/** Readable random password: no look-alike characters. Generated in the browser. */
function generatePassword(length = 14) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const toast = useToast();
  return (
    <div className="flex gap-1.5">
      <Input value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} className="font-mono" />
      <Button size="icon" aria-label="Generate password" onClick={() => onChange(generatePassword())}>
        <RefreshCw />
      </Button>
      <Button
        size="icon"
        aria-label="Copy password"
        disabled={!value}
        onClick={() => navigator.clipboard.writeText(value).then(() => toast({ title: "Password copied", tone: "success" }))}
      >
        <Copy />
      </Button>
    </div>
  );
}

export function TeamManager({ team, staff, currentUserId }: { team: TeamMember[]; staff: StaffListItem[]; currentUserId: string }) {
  const { run, busy } = useMutation();
  const [adding, setAdding] = useState<{ name: string; email: string; role: Role; password: string; staffId: string } | null>(null);
  const [roleFor, setRoleFor] = useState<{ member: TeamMember; role: Role; staffId: string } | null>(null);
  const [passwordFor, setPasswordFor] = useState<{ member: TeamMember; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedStaff = new Set(team.map((m) => m.staffId).filter(Boolean));
  const freeStaff = (keep?: string | null) => staff.filter((s) => !linkedStaff.has(s.id) || s.id === keep);
  const fail = (e: Error) => {
    setError(e.message);
    throw e;
  };

  async function add() {
    if (!adding) return;
    setError(null);
    const ok = await run(
      () => adminFetch("/api/admin/team", { method: "POST", body: { ...adding, staffId: adding.role === "staff" && adding.staffId ? adding.staffId : null } }).catch(fail),
      `${adding.name} can now sign in`,
    );
    if (ok) setAdding(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            setAdding({ name: "", email: "", role: "receptionist", password: generatePassword(), staffId: "" });
          }}
        >
          <Plus /> Add person
        </Button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Person</th>
              <th className="th">Role</th>
              <th className="th">Last active</th>
              <th className="th">Status</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {team.map((m) => {
              const last = m.lastActiveAt ? new Date(m.lastActiveAt) : null;
              const isMe = m.id === currentUserId;
              return (
                <tr key={m.id} className={m.active ? undefined : "text-muted"}>
                  <td className="td">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.name} size="md" />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {m.name} {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
                        </span>
                        <span className="block text-xs text-muted">{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="td whitespace-nowrap">
                    {ROLE[m.role]}
                    {m.staffName && <span className="block text-xs text-muted">{m.staffName}</span>}
                  </td>
                  <td className="td whitespace-nowrap text-muted tabular-nums">
                    {last ? `${formatDate(toIst(last).date)}, ${formatInstantTime(last)}` : "Never"}
                  </td>
                  <td className="td">{m.active ? <Chip tone="success">Active</Chip> : <Chip>Deactivated</Chip>}</td>
                  <td className="td w-10 text-right">
                    <RowActions
                      extra={
                        <>
                          {!isMe && (
                            <MenuItem
                              onSelect={() => {
                                setError(null);
                                setRoleFor({ member: m, role: m.role, staffId: m.staffId ?? "" });
                              }}
                            >
                              <ShieldCheck /> Change role
                            </MenuItem>
                          )}
                          <MenuItem
                            onSelect={() => {
                              setError(null);
                              setPasswordFor({ member: m, password: generatePassword() });
                            }}
                          >
                            <KeyRound /> Reset password
                          </MenuItem>
                          {!isMe &&
                            (m.active ? (
                              <MenuItem
                                tone="danger"
                                onSelect={() =>
                                  run(() => adminFetch(`/api/admin/team/${m.id}`, { method: "PATCH", body: { active: false } }), `${m.name} deactivated and signed out`)
                                }
                              >
                                <UserX /> Deactivate
                              </MenuItem>
                            ) : (
                              <MenuItem onSelect={() => run(() => adminFetch(`/api/admin/team/${m.id}`, { method: "PATCH", body: { active: true } }), `${m.name} reactivated`)}>
                                <UserCheck /> Reactivate
                              </MenuItem>
                            ))}
                        </>
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add person */}
      <Dialog open={adding !== null} onOpenChange={(o) => !o && !busy && setAdding(null)}>
        {adding && (
          <DialogContent
            title="Add person"
            description="Share the email and password with them privately. They can sign in at /admin."
            footer={
              <>
                <Button size="md" onClick={() => setAdding(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  loading={busy}
                  disabled={adding.name.trim().length < 2 || !adding.email.includes("@") || adding.password.length < 10}
                  onClick={add}
                >
                  Add person
                </Button>
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={adding.name} maxLength={60} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={adding.email} autoComplete="off" onChange={(e) => setAdding({ ...adding, email: e.target.value })} />
              </Field>
              <Field label="Role" hint={ROLE_HINT[adding.role]} className="sm:col-span-2">
                <Select<Role> value={adding.role} onValueChange={(role) => setAdding({ ...adding, role })} options={ROLE_OPTIONS} />
              </Field>
              {adding.role === "staff" && (
                <Field label="Artist profile" className="sm:col-span-2">
                  <Select
                    value={adding.staffId}
                    onValueChange={(staffId) => setAdding({ ...adding, staffId })}
                    options={[{ value: "", label: "Not linked yet" }, ...freeStaff().map((s) => ({ value: s.id, label: s.name }))]}
                  />
                </Field>
              )}
              <Field label="Starting password" hint="At least 10 characters. Copy it before saving." className="sm:col-span-2">
                <PasswordInput value={adding.password} onChange={(password) => setAdding({ ...adding, password })} />
              </Field>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </DialogContent>
        )}
      </Dialog>

      {/* Change role */}
      <Dialog open={roleFor !== null} onOpenChange={(o) => !o && !busy && setRoleFor(null)}>
        {roleFor && (
          <DialogContent
            size="sm"
            title={`Change ${roleFor.member.name}'s role`}
            footer={
              <>
                <Button size="md" onClick={() => setRoleFor(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  loading={busy}
                  onClick={async () => {
                    setError(null);
                    const ok = await run(
                      () =>
                        adminFetch(`/api/admin/team/${roleFor.member.id}`, {
                          method: "PATCH",
                          body: { role: roleFor.role, staffId: roleFor.role === "staff" ? roleFor.staffId || null : null },
                        }).catch(fail),
                      "Role updated",
                    );
                    if (ok) setRoleFor(null);
                  }}
                >
                  Save
                </Button>
              </>
            }
          >
            <Field label="Role" hint={ROLE_HINT[roleFor.role]}>
              <Select<Role> value={roleFor.role} onValueChange={(role) => setRoleFor({ ...roleFor, role })} options={ROLE_OPTIONS} />
            </Field>
            {roleFor.role === "staff" && (
              <Field label="Artist profile">
                <Select
                  value={roleFor.staffId}
                  onValueChange={(staffId) => setRoleFor({ ...roleFor, staffId })}
                  options={[{ value: "", label: "Not linked yet" }, ...freeStaff(roleFor.member.staffId).map((s) => ({ value: s.id, label: s.name }))]}
                />
              </Field>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
          </DialogContent>
        )}
      </Dialog>

      {/* Reset password */}
      <Dialog open={passwordFor !== null} onOpenChange={(o) => !o && !busy && setPasswordFor(null)}>
        {passwordFor && (
          <DialogContent
            size="sm"
            title={`Reset ${passwordFor.member.name}'s password`}
            description={passwordFor.member.id === currentUserId ? "You'll stay signed in here." : "They'll be signed out everywhere and need the new password."}
            footer={
              <>
                <Button size="md" onClick={() => setPasswordFor(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  loading={busy}
                  disabled={passwordFor.password.length < 10}
                  onClick={async () => {
                    setError(null);
                    const ok = await run(
                      () =>
                        adminFetch(`/api/admin/team/${passwordFor.member.id}/password`, { method: "POST", body: { password: passwordFor.password } }).catch(fail),
                      "Password reset",
                    );
                    if (ok) setPasswordFor(null);
                  }}
                >
                  Reset password
                </Button>
              </>
            }
          >
            <Field label="New password" hint="Copy it before saving and share it privately.">
              <PasswordInput value={passwordFor.password} onChange={(password) => setPasswordFor({ ...passwordFor, password })} />
            </Field>
            {error && <p className="text-xs text-danger">{error}</p>}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
