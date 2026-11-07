import { PaymentAssignmentDialog } from '@/features/payment-accounts/components/payment-assignment-dialog'
import { useApproveKyc, type KycQueueItem } from '../api'

export function ApproveDialog({
  member,
  open,
  onOpenChange,
  onApproved,
}: {
  member: KycQueueItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onApproved?: () => void
}) {
  const approve = useApproveKyc()
  return (
    <PaymentAssignmentDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Approve ${member.fullName ?? 'member'}`}
      description="Choose the company UPI account this member pays into, and the amount."
      memberName={member.fullName}
      memberMobile={member.mobile}
      submitLabel="Approve"
      confirmTitle="Approve this account?"
      confirmDescription="This approves the KYC, verifies the pending bank account and assigns the payment below to the member."
      pending={approve.isPending}
      onSubmit={async (payment) => {
        if (!member.userId) return
        await approve.mutateAsync({ userId: member.userId, payment })
        onApproved?.()
      }}
    />
  )
}
