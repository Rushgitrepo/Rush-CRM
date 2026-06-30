import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Calendar,
  AlertCircle,
  DollarSign,
  Banknote,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const STATUS_ICONS: Record<string, any> = {
  approved: CheckCircle,
  rejected: XCircle,
  pending: Clock,
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TeamLeavesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const qc = useQueryClient();

  // Fetch team leave requests
  const { data: requestsResp, isLoading } = useQuery({
    queryKey: ["team-leave-requests", statusFilter],
    queryFn: () =>
      api.get("/leave", {
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    refetchInterval: 10000,
  });
  // Never show cancelled in team view
  const allRequests = ((requestsResp as any)?.data || []).filter(
    (r: any) => r.status !== "cancelled",
  );

  // Filter by search
  const requests = allRequests.filter((r: any) =>
    search
      ? r.employee_name.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["team-leave-requests"] });
    qc.invalidateQueries({ queryKey: ["leave-calendar"] });
    qc.invalidateQueries({ queryKey: ["leave-analytics"] });
    qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
  };

  const approvePaidMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/leave/${id}`, { status: "approved", paid_status: "paid" }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Leave approved as Paid");
    },
    onError: () => toast.error("Failed to approve request"),
  });

  const approveUnpaidMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/leave/${id}`, { status: "approved", paid_status: "unpaid" }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Leave approved as Unpaid");
    },
    onError: () => toast.error("Failed to approve request"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/leave/${id}`, {
        status: "rejected",
        rejection_reason: reason,
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Leave request rejected");
      setRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
    },
    onError: () => toast.error("Failed to reject request"),
  });

  const handleReject = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate({ id: selectedRequest.id, reason: rejectionReason });
  };

  const pendingCount = requests.filter(
    (r: any) => r.status === "pending",
  ).length;
  const approvedCount = requests.filter(
    (r: any) => r.status === "approved",
  ).length;
  const rejectedCount = requests.filter(
    (r: any) => r.status === "rejected",
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {pendingCount}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {approvedCount}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {rejectedCount}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by employee name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No leave requests found</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request: any) => {
                const Icon = STATUS_ICONS[request.status] || Clock;
                const duration =
                  differenceInDays(
                    new Date(request.end_date),
                    new Date(request.start_date),
                  ) + 1;

                return (
                  <div key={request.id} className="p-4 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Employee Info */}
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {getInitials(request.employee_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold">
                              {request.employee_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {request.department || "No Department"}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs shrink-0",
                              STATUS_COLORS[request.status],
                            )}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {request.status}
                          </Badge>
                        </div>

                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className="w-1 h-full min-h-[2rem] rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: request.leave_type_color }}
                          />
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-4 flex-wrap text-sm">
                              <p className="font-medium whitespace-nowrap">
                                {request.leave_type_name}
                              </p>
                              <span className="flex items-center gap-1 text-gray-600 whitespace-nowrap">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(request.start_date), "MMM d")} –{" "}
                                {format(new Date(request.end_date), "MMM d, yyyy")}
                              </span>
                              <span className="font-medium whitespace-nowrap">
                                {duration} day{duration > 1 ? "s" : ""}
                              </span>
                              {request.emergency && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 whitespace-nowrap">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Emergency
                                </Badge>
                              )}
                              <p className="text-sm dark:text-white truncate flex-1">
                                <span className="font-semibold text-blue-700">Reason:</span>{" "}
                                {request.reason}
                              </p>
                            </div>

                            {/* Leave Balance — compact AL:4 ML:3 SL:3 — only on pending */}
                            {request.status === "pending" && request.all_balances && request.all_balances.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-xs text-muted-foreground font-medium">Balance:</span>
                                {request.all_balances.map((b: any) => (
                                  <span
                                    key={b.code}
                                    className={cn(
                                      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold border",
                                      b.available <= 0
                                        ? "bg-red-50 border-red-300 text-red-700"
                                        : "bg-muted/50 border-border text-foreground"
                                    )}
                                    title={`${b.name}: ${b.available} / ${b.total} remaining`}
                                  >
                                    <span className="opacity-70">{b.code}:</span>
                                    <span style={{ color: b.available <= 0 ? undefined : b.color }}>
                                      {b.available ?? 0}
                                    </span>
                                  </span>
                                ))}
                                {request.bal_available <= 0 && (
                                  <span className="text-xs text-orange-600 font-medium">· Balance exhausted</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {request.contact_during_leave && (
                          <p className="text-xs text-gray-500">
                            Contact: {request.contact_during_leave}
                          </p>
                        )}

                        {request.rejection_reason && (
                          <div className="mt-2">
                            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              <strong>Rejection reason:</strong>{" "}
                              {request.rejection_reason}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {request.status === "pending" && (
                        <div className="flex flex-row gap-1.5 shrink-0 flex-wrap justify-end">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                            onClick={() =>
                              approvePaidMutation.mutate(request.id)
                            }
                            disabled={
                              approvePaidMutation.isPending ||
                              approveUnpaidMutation.isPending
                            }
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            Paid
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2"
                            onClick={() =>
                              approveUnpaidMutation.mutate(request.id)
                            }
                            disabled={
                              approvePaidMutation.isPending ||
                              approveUnpaidMutation.isPending
                            }
                          >
                            <Banknote className="h-3 w-3 mr-1" />
                            Unpaid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50 px-2"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRejectDialog(true);
                            }}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {request.status === "approved" && request.paid_status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-xs",
                            request.paid_status === "paid"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-orange-50 text-orange-700 border-orange-200",
                          )}
                        >
                          {request.paid_status === "paid" ? (
                            <DollarSign className="h-3 w-3 mr-1" />
                          ) : (
                            <Banknote className="h-3 w-3 mr-1" />
                          )}
                          {request.paid_status === "paid" ? "Paid" : "Unpaid"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              {selectedRequest &&
                `${selectedRequest.employee_name} - ${selectedRequest.leave_type_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRequest && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="text-gray-700">{selectedRequest.reason}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Rejection Reason (Optional)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
