<script lang="ts">
  import { appState, postsByDate, contentStore } from '$lib/stores/contentStore';
  import type { ContentPost, CalendarDay } from '$lib/types';
  import { 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    format, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths 
  } from 'date-fns';

  let currentMonth = $state(new Date());
  let selectedDate = $derived($appState.selectedDate);
  let postMap = $derived($postsByDate);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getCalendarDays(): CalendarDay[] {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = eachDayOfInterval({ start, end });
    
    return days.map(date => ({
      date,
      isCurrentMonth: isSameMonth(date, currentMonth),
      isToday: isSameDay(date, new Date()),
      posts: postMap.get(format(date, 'yyyy-MM-dd')) || [],
    }));
  }

  let calendarDays = $derived(getCalendarDays());

  function prevMonth() {
    currentMonth = subMonths(currentMonth, 1);
  }

  function nextMonth() {
    currentMonth = addMonths(currentMonth, 1);
  }

  function selectDay(day: CalendarDay) {
    contentStore.selectDate(day.date);
  }

  function getPostStyles(status: ContentPost['status']): string {
    switch (status) {
      case 'draft': return 'bg-slate-600/30 text-slate-400';
      case 'pending': return 'bg-violet-500/20 text-violet-400';
      case 'approved': return 'bg-emerald-500/20 text-emerald-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-600/30 text-slate-400';
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Calendar Header -->
  <div class="flex items-center justify-between p-4 border-b border-loopt-border">
    <div class="flex items-center gap-4">
      <h2 class="text-2xl font-bold text-loopt-text">
        {format(currentMonth, 'MMMM yyyy')}
      </h2>
      <div class="flex gap-1">
        <button 
          class="p-2 hover:bg-loopt-surface-hover rounded-lg transition-colors"
          onclick={prevMonth}
          aria-label="Previous month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <button 
          class="p-2 hover:bg-loopt-surface-hover rounded-lg transition-colors"
          onclick={nextMonth}
          aria-label="Next month"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
    <button 
      class="btn-primary"
      onclick={() => contentStore.openEditor()}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      New Post
    </button>
  </div>

  <!-- Week Days Header -->
  <div class="grid grid-cols-7 border-b border-loopt-border">
    {#each weekDays as day}
      <div class="p-3 text-center text-sm font-medium text-loopt-text-muted">
        {day}
      </div>
    {/each}
  </div>

  <!-- Calendar Grid -->
  <div class="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
    {#each calendarDays as day}
      <button
        class="calendar-day border-b border-r border-loopt-border p-2 text-left flex flex-col min-h-[100px] {!day.isCurrentMonth ? 'opacity-40' : ''} {day.isToday ? 'ring-2 ring-loopt-accent ring-inset' : ''} {isSameDay(day.date, selectedDate) ? 'bg-loopt-accent/10' : ''}"
        onclick={() => selectDay(day)}
      >
        <span class="text-sm font-medium {day.isToday ? 'bg-loopt-accent text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}">
          {format(day.date, 'd')}
        </span>
        
        {#if day.posts.length > 0}
          <div class="mt-2 space-y-1 flex-1 overflow-hidden">
            {#each day.posts.slice(0, 3) as post}
              <button 
                class="text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity w-full text-left {getPostStyles(post.status)}"
                onclick={(e) => {
                  e.stopPropagation();
                  contentStore.openEditor(post);
                }}
              >
                {post.idea || post.caption?.substring(0, 30) || 'Untitled'}
              </button>
            {/each}
            {#if day.posts.length > 3}
              <div class="text-xs text-loopt-text-muted px-2">
                +{day.posts.length - 3} more
              </div>
            {/if}
          </div>
        {/if}
      </button>
    {/each}
  </div>
</div>
