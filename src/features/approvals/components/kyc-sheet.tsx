import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DocumentViewer } from '@/components/shared/document-viewer'
import { DateTime, Money, PlainDate } from '@/components/shared/format'
import { DetailList } from '@/components/shared/layout'
import { PiiReveal } from '@/components/shared/pii-reveal'
import { StatusBadge, WarningBadge } from '@/components/shared/status-badge'
import { useConfirm } from '@/components/shared/confirm'
import { humanize } from '@/lib/format'
import { namesMatch } from '@/lib/validation'
import { revealAccountNumber } from '@/features/bank-accounts/api'
import { revealIdentity, useRejectKyc, type KycQueueItem } from '../api'
import { ApproveDialog } from './approve-dialog'

export function KycSheet({
  member,
  onClose,
}: {
  member: KycQueueItem | undefined
  onClose: () => void
}) {
  const confirm = useConfirm()
  const reject = useRejectKyc()
  const [approveOpen, setApproveOpen] = useState(false)

  const bank = member?.bankAccount
  const mismatch = !!member && !!bank && !namesMatch(member.fullName, bank.holderName)
  const canDecide = member?.status === 'KYC_SUBMITTED'

  async function onReject() {
    if (!member?.userId) return
    const res = await confirm({
      title: `Reject ${member.fullName ?? 'this member'}?`,
      description: 'The member sees this reason in the app and can resubmit.',
      details: [
        { label: 'Member', value: member.fullName },
        { label: 'Mobile', value: member.mobile },
      ],
      reason: { label: 'Reason shown to the member', required: true, minLength: 5 },
      confirmLabel: 'Reject',
      destructive: true,
    })
    if (!res?.reason) return
    await reject.mutateAsync({ userId: member.userId, reason: res.reason })
    onClose()
  }

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {member ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl font-extrabold">
                  {member.fullName ?? 'Unnamed member'}
                </SheetTitle>
                <StatusBadge status={member.status} />
              </div>
              <SheetDescription>
                {member.mobile} · submitted <DateTime value={member.submittedAt} />
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4">
              <section aria-labelledby="kyc-h" className="space-y-3">
                <h3
                  id="kyc-h"
                  className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase"
                >
                  KYC
                </h3>
                <DetailList
                  items={[
                    { label: 'Full name', value: member.fullName },
                    { label: 'Date of birth', value: <PlainDate value={member.dob} /> },
                    {
                      label: 'PAN',
                      value: member.userId ? (
                        <PiiReveal
                          masked={member.panMasked}
                          label="PAN"
                          fetchValue={() => revealIdentity(member.userId!, 'PAN')}
                        />
                      ) : null,
                    },
                    {
                      label: 'Aadhaar',
                      value: member.userId ? (
                        <PiiReveal
                          masked={member.aadhaarMasked}
                          label="Aadhaar"
                          fetchValue={() => revealIdentity(member.userId!, 'AADHAAR')}
                        />
                      ) : null,
                    },
                  ]}
                />
                {member.rejectionReason ? (
                  <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
                    Previously rejected: {member.rejectionReason}
                  </p>
                ) : null}
              </section>

              <Separator />

              <section aria-labelledby="bank-h" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="bank-h"
                    className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase"
                  >
                    Bank account
                  </h3>
                  {bank ? <StatusBadge status={bank.status} /> : null}
                  {mismatch ? (
                    <WarningBadge>
                      <AlertTriangle className="size-3" aria-hidden /> Name differs from KYC
                    </WarningBadge>
                  ) : null}
                </div>
                {bank ? (
                  <>
                    <DetailList
                      items={[
                        { label: 'Holder name', value: bank.holderName },
                        {
                          label: 'Account',
                          value: bank.id ? (
                            <PiiReveal
                              masked={bank.accountNumberMasked}
                              label="account number"
                              fetchValue={() => revealAccountNumber(bank.id!)}
                            />
                          ) : (
                            <span className="font-mono">{bank.accountNumberMasked}</span>
                          ),
                        },
                        { label: 'IFSC', value: <span className="font-mono">{bank.ifsc}</span> },
                        { label: 'Type', value: humanize(bank.accountType) },
                        { label: 'UPI ID', value: bank.vpa },
                        { label: 'Added', value: <DateTime value={bank.createdAt} /> },
                      ]}
                    />
                    {bank.proofDocumentId ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs font-bold">Bank proof</p>
                        <DocumentViewer documentId={bank.proofDocumentId} title="Bank proof" />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">No bank account submitted.</p>
                )}
              </section>

              {member.paymentAssignment ? (
                <>
                  <Separator />
                  <section aria-labelledby="pay-h" className="space-y-3">
                    <h3
                      id="pay-h"
                      className="text-muted-foreground text-xs font-extrabold tracking-wider uppercase"
                    >
                      Payment assignment
                    </h3>
                    <DetailList
                      items={[
                        { label: 'UPI ID', value: member.paymentAssignment.paymentAccount?.vpa },
                        {
                          label: 'Payee',
                          value: member.paymentAssignment.paymentAccount?.payeeName,
                        },
                        {
                          label: 'Amount',
                          value: <Money value={member.paymentAssignment.amount} />,
                        },
                        {
                          label: 'Assigned',
                          value: <DateTime value={member.paymentAssignment.assignedAt} />,
                        },
                      ]}
                    />
                  </section>
                </>
              ) : null}
            </div>

            {canDecide ? (
              <SheetFooter className="flex-row gap-2 border-t">
                <Button
                  variant="outline"
                  className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-400"
                  onClick={onReject}
                  disabled={reject.isPending}
                >
                  <X className="size-4" /> Reject
                </Button>
                <Button className="flex-1" onClick={() => setApproveOpen(true)}>
                  <Check className="size-4" /> Approve
                </Button>
              </SheetFooter>
            ) : null}

            <ApproveDialog
              member={member}
              open={approveOpen}
              onOpenChange={setApproveOpen}
              onApproved={onClose}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
