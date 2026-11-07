import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useConfirm } from '@/components/shared/confirm'
import { DocumentViewer } from '@/components/shared/document-viewer'
import { DateTime, Money } from '@/components/shared/format'
import { DetailList } from '@/components/shared/layout'
import { StatusBadge } from '@/components/shared/status-badge'
import { MemberName } from '@/features/members/member-name'
import { useApproveInvestment, useRejectInvestment, type Investment } from '../api'

export function InvestmentSheet({
  investment,
  onClose,
}: {
  investment: Investment | undefined
  onClose: () => void
}) {
  const confirm = useConfirm()
  const approve = useApproveInvestment()
  const reject = useRejectInvestment()

  const name = investment?.fullName || investment?.mobile || 'this member'
  const pending = investment?.status === 'PENDING_VERIFICATION'

  async function onApprove() {
    if (!investment?.id) return
    const ok = await confirm({
      title: 'Approve this payment?',
      description:
        'The deposit is posted to the member’s ledger and the investment becomes active.',
      details: [
        { label: 'Member', value: name },
        { label: 'Mobile', value: investment.mobile },
        { label: 'Amount', value: <Money value={investment.amount} /> },
      ],
      confirmLabel: 'Approve payment',
    })
    if (!ok) return
    await approve.mutateAsync(investment.id)
    onClose()
  }

  async function onReject() {
    if (!investment?.id) return
    const res = await confirm({
      title: 'Reject this payment proof?',
      description: 'The member sees the reason and can upload a new proof.',
      details: [
        { label: 'Member', value: name },
        { label: 'Amount', value: <Money value={investment.amount} /> },
      ],
      reason: { label: 'Reason shown to the member', required: true, minLength: 5 },
      confirmLabel: 'Reject',
      destructive: true,
    })
    if (!res?.reason) return
    await reject.mutateAsync({ id: investment.id, reason: res.reason })
    onClose()
  }

  return (
    <Sheet open={!!investment} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {investment ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl font-extrabold">
                  <Money value={investment.amount} />
                </SheetTitle>
                <StatusBadge status={investment.status} />
              </div>
              <SheetDescription asChild>
                <div>
                  <MemberName
                    userId={investment.userId}
                    fullName={investment.fullName}
                    mobile={investment.mobile}
                  />
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4">
              <DetailList
                items={[
                  { label: 'Submitted', value: <DateTime value={investment.createdAt} /> },
                  { label: 'Approved', value: <DateTime value={investment.approvedAt} /> },
                  {
                    label: 'Expected UPI',
                    value: investment.expectedVpa ?? 'No payment assignment',
                  },
                  { label: 'Expected amount', value: <Money value={investment.expectedAmount} /> },
                  {
                    label: 'Remaining principal',
                    value: <Money value={investment.remainingPrincipal} />,
                  },
                  { label: 'Earned so far', value: <Money value={investment.earnedSoFar} /> },
                ]}
              />
              {investment.rejectionReason ? (
                <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
                  Rejected: {investment.rejectionReason}
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase">
                  Payment proof
                </p>
                <DocumentViewer documentId={investment.proofDocumentId} title="Payment proof" />
              </div>
            </div>
            {pending ? (
              <SheetFooter className="flex-row gap-2 border-t">
                <Button
                  variant="outline"
                  className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
                  onClick={onReject}
                  disabled={reject.isPending || approve.isPending}
                >
                  <X className="size-4" /> Reject
                </Button>
                <Button
                  className="flex-1"
                  onClick={onApprove}
                  disabled={approve.isPending || reject.isPending}
                >
                  <Check className="size-4" /> Approve
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
