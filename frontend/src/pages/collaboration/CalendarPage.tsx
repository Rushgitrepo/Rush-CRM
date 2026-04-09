import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Settings, ChevronLeft, ChevronRight, ChevronDown, Check, Users, Clock, RefreshCw } from "lucide-react";
import { CalendarMiniWidget } from "@/components/calendar/CalendarMiniWidget";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarScheduleView } from "@/components/calendar/CalendarScheduleView";
import { CalendarInvitationsView } from "@/components/calendar/CalendarInvitationsView";
import { ConnectCalendarsDialog } from "@/components/calendar/ConnectCalendarsDialog";
import { CalendarConnectSuccessDialog } from "@/components/calendar/CalendarConnectSuccessDialog";
import { ManageCalendarDialog } from "@/components/calendar/ManageCalendarDialog";
import { CalendarSettingsDialog } from "@/components/calendar/CalendarSettingsDialog";
import { ICloudCredentialsDialog } from "@/components/calendar/ICloudCredentialsDialog";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { useCalendarConnections } from "@/hooks/useCalendarConnections";
import { useToast } from "@/hooks/use-toast";

type ViewType = "day" | "week" | "month" | "schedule" | "invitations";

const viewTabs: { id: ViewType; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "schedule", label: "Schedule" },
  { id: "invitations", label: "Invitations" },
];

const providerNames: Record<string, string> = {
  google: "Google Calendar",
  icloud: "iCloud Calendar",
  microsoft: "Microsoft Calendar",
};

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<ViewType>("month");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [icloudDialogOpen, setIcloudDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [defaultEventHour, setDefaultEventHour] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [connectSuccessOpen, setConnectSuccessOpen] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { connections, connect, sync, disconnect, connectICloud, syncICloudEvents, syncMicrosoftEvents, disconnectByProvider } = useCalendarConnections();

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setConnectedProvider(connected);
      setConnectSuccessOpen(true);
      // Trigger auto-sync for newly connected provider
      sync(connected);
      // Clear params
      setSearchParams({}, { replace: true });
      // Refresh connections
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    }
    if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, toast, sync]);

  // Compute date range for the current view
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    if (activeView === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (activeView === "week") {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [selectedDate, activeView]);

  const { events: rawEvents, isLoading } = useCalendarEvents(
    searchQuery ? undefined : dateRange.start, 
    searchQuery ? undefined : dateRange.end, 
    searchQuery
  );

  const events = useMemo(() => {
    if (!searchQuery.trim()) return rawEvents;
    const query = searchQuery.toLowerCase();
    return rawEvents.filter(e => {
      const dateStr = format(new Date(e.start_time), 'EEEE MMMM d yyyy').toLowerCase(); // e.g. "monday april 12 2026"
      return e.title.toLowerCase().includes(query) || 
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        dateStr.includes(query);
    });
  }, [rawEvents, searchQuery]);

  const connectedProviders = connections.map(c => c.provider);
  const hasConnectedCalendar = connectedProviders.length > 0;

  const handleConnect = async (providerId: string) => {
    if (providerId === "icloud") {
      try {
        await connectICloud.mutateAsync({});
        sync(providerId);
        setConnectDialogOpen(false);
      } catch (err) {
        setConnectDialogOpen(false);
        setIcloudDialogOpen(true);
      }
      return;
    }
    connect(providerId);
  };

  const handleICloudConnect = async (appleId: string, appPassword: string) => {
    try {
      await connectICloud.mutateAsync({ appleId, appPassword });
      sync("icloud");
      setIcloudDialogOpen(false);
    } catch (err) {
      // Error handled by mutation toast
    }
  };

  const handleDisconnect = (providerId: string) => {
    disconnect(providerId);
  };

  const handleManageCalendar = (providerId: string) => {
    setSelectedProvider(providerId);
    setManageDialogOpen(true);
  };

  const handleSync = (providerId?: string) => {
    const target = providerId || selectedProvider;
    if (target) {
      sync(target);
      return;
    }
    toast({ title: "Syncing...", description: "Your calendar is being synchronized." });
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleSlotClick = (date: Date, hour?: number) => {
    setSelectedDate(date);
    setDefaultEventHour(hour);
    setCreateEventOpen(true);
  };

  const formatHeaderDate = () => {
    if (activeView === "day") return selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (activeView === "week") return selectedDate.toLocaleDateString('en-US', { month: 'long' });
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getWeekdayName = () => selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

  const navigatePrev = () => {
    const d = new Date(selectedDate);
    if (activeView === "day") d.setDate(d.getDate() - 1);
    else if (activeView === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const navigateNext = () => {
    const d = new Date(selectedDate);
    if (activeView === "day") d.setDate(d.getDate() + 1);
    else if (activeView === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  const renderView = () => {
    // If searching, force schedule view to show results from any date
    if (searchQuery.trim()) {
      return (
        <CalendarScheduleView 
          onConnectClick={() => setConnectDialogOpen(true)} 
          hasConnectedCalendar={hasConnectedCalendar} 
          events={events} 
          onEventClick={handleEventClick} 
        />
      );
    }

    switch (activeView) {
      case "day":
        return <CalendarDayView selectedDate={selectedDate} events={events} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />;
      case "week":
        return <CalendarWeekView selectedDate={selectedDate} events={events} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />;
      case "month":
        return <CalendarMonthView selectedDate={selectedDate} onDateSelect={setSelectedDate} events={events} onEventClick={handleEventClick} onSlotClick={(d) => handleSlotClick(d)} />;
      case "schedule":
        return <CalendarScheduleView onConnectClick={() => setConnectDialogOpen(true)} hasConnectedCalendar={hasConnectedCalendar} events={events} onEventClick={handleEventClick} />;
      case "invitations":
        return <CalendarInvitationsView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Professional Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 dark:bg-slate-900/80 dark:border-slate-700/60">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Calendar
              </h1>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage your schedule and events
              </p>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 rounded-lg">
                    <Plus className="h-4 w-4" />
                    Create Event
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuItem onClick={() => setCreateEventOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Event
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setDefaultEventHour(undefined); setCreateEventOpen(true); }}>
                    <Users className="h-4 w-4 mr-2" />
                    New Meeting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setDefaultEventHour(undefined); setCreateEventOpen(true); }}>
                    <Clock className="h-4 w-4 mr-2" />
                    New Reminder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search events..." 
                  className="pl-9 w-64 bg-white/60 border-slate-200 focus:bg-white dark:bg-slate-800/60 dark:border-slate-700" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-lg bg-white/60 hover:bg-primary dark:bg-slate-800/60 dark:hover:bg-slate-800" 
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        <div className="flex gap-6">
          {/* Calendar Main View */}
          <div className="flex-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-xl shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700/60 overflow-hidden">
              {/* Calendar Header */}
              <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {formatHeaderDate()}
                    </h2>
                    {activeView === "day" && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {getWeekdayName()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* View Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 bg-white dark:bg-slate-800">
                          {activeView.charAt(0).toUpperCase() + activeView.slice(1)} View
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setActiveView("day")}>Day View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActiveView("week")}>Week View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActiveView("month")}>Month View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActiveView("schedule")}>Schedule View</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Navigation */}
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={navigatePrev} className="hover:bg-primary dark:hover:bg-slate-800">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedDate(new Date())}
                        className={`px-4 rounded-lg border-primary/20 hover:bg-primary transition-all
                          ${format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') 
                            ? 'bg-primary/10 text-primary border-primary/40 font-semibold' 
                            : 'bg-white dark:bg-slate-800'
                          }
                        `}
                      >
                        Today
                      </Button>

                      <Button variant="ghost" size="icon" onClick={navigateNext} className="hover:bg-primary dark:hover:bg-slate-800">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar View Content */}
              <div className="min-h-[600px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Loading calendar...</p>
                    </div>
                  </div>
                ) : (
                  renderView()
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-xl shadow-slate-900/5 dark:bg-slate-900/90 dark:border-slate-700/60 overflow-hidden">
              {/* Mini Calendar */}
              <div className="p-6">
                <CalendarMiniWidget selectedDate={selectedDate} onDateSelect={setSelectedDate} />
              </div>

              {/* Calendar Connections */}
              <div className="px-6 pb-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Calendar Connections</h3>
                  
                  {hasConnectedCalendar ? (
                    <div className="space-y-2">
                      {connections.map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium">{providerNames[conn.provider] || conn.provider}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleSync(conn.provider)}
                              className="text-xs"
                              title="Sync"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleManageCalendar(conn.provider)}
                              className="text-xs"
                            >
                              Manage
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button 
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg shadow-green-500/25" 
                        onClick={() => setConnectDialogOpen(true)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Sync Calendars
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25" 
                      onClick={() => setConnectDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Calendar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom View Tabs */}
      <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-slate-200/60 dark:bg-slate-900/80 dark:border-slate-700/60">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {viewTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeView === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView(tab.id)}
                className={`px-4 text-xs transition-all ${
                  activeView === tab.id 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                } ${tab.id === "invitations" ? 'flex items-center gap-1' : ''}`}
              >
                {tab.id === "invitations" && <span className="text-green-600">@</span>}
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConnectCalendarsDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        connectedCalendars={connectedProviders}
        onConnect={handleConnect}
        onSync={(id) => sync(id)}
        onDisconnect={(id) => disconnect(id)}
      />
      <ManageCalendarDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        providerId={selectedProvider}
        providerName={providerNames[selectedProvider] || "Calendar"}
        onSync={handleSync}
        onDisconnect={() => handleDisconnect(selectedProvider)}
      />
      <ICloudCredentialsDialog
        open={icloudDialogOpen}
        onOpenChange={setIcloudDialogOpen}
        onConnect={handleICloudConnect}
        isConnecting={connectICloud.isPending}
      />
      <CalendarSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
      <CreateEventDialog
        open={createEventOpen}
        onOpenChange={setCreateEventOpen}
        defaultDate={selectedDate}
        defaultHour={defaultEventHour}
      />
      <EventDetailDialog
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        event={events.find(e => e.id === selectedEvent?.id) || selectedEvent}
      />
      <CalendarConnectSuccessDialog
        open={connectSuccessOpen}
        onOpenChange={setConnectSuccessOpen}
        provider={connectedProvider}
      />
    </div>
  );
}
