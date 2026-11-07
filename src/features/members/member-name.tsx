import { Link } from '@tanstack/react-router'

/**
 * Name + mobile from the row itself (no lookup). `fullName` is null until the
 * member completes KYC, so fall back to the mobile.
 */
export function MemberName({
  userId,
  fullName,
  mobile,
  link = true,
}: {
  userId: string | null | undefined
  fullName: string | null | undefined
  mobile: string | null | undefined
  link?: boolean
}) {
  const body = (
    <span className="block min-w-0">
      <span className="block truncate font-bold">{fullName || mobile || 'Unknown member'}</span>
      {fullName ? (
        <span className="text-muted-foreground block text-xs">{mobile}</span>
      ) : (
        <span className="text-muted-foreground block text-xs">KYC not completed</span>
      )}
    </span>
  )
  return link && userId ? (
    <Link
      to="/members/$userId"
      params={{ userId }}
      className="hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </Link>
  ) : (
    body
  )
}
