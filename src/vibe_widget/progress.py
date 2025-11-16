import anywidget
import traitlets


class ProgressWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
      el.innerHTML = `
        <style>
          * {
            box-sizing: border-box;
          }
          
          .vibe-container {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 700px;
            margin: 0;
          }
          
          .vibe-progress-wrapper {
            transition: opacity 300ms ease-out, transform 300ms ease-out;
          }
          
          .vibe-progress-wrapper.hidden {
            opacity: 0;
            transform: translateY(-10px);
            pointer-events: none;
          }
          
          /* Header with spinner */
          .vibe-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          
          .vibe-spinner {
            width: 18px;
            height: 18px;
            border: 2px solid #e5e7eb;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .vibe-title {
            font-size: 15px;
            font-weight: 600;
            color: #111827;
          }
          
          /* Micro Bubbles */
          .vibe-bubbles {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 12px;
            min-height: 30px;
          }
          
          .vibe-bubble {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #f3f4f6;
            border-radius: 16px;
            font-size: 12px;
            color: #6b7280;
            max-width: fit-content;
            animation: bubbleIn 100ms cubic-bezier(0.34, 1.56, 0.64, 1);
            opacity: 1;
            transition: opacity 300ms ease-out;
          }
          
          .vibe-bubble.fade-out {
            opacity: 0;
          }
          
          @keyframes bubbleIn {
            from {
              opacity: 0;
              transform: translateY(4px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          /* Execution Console */
          .vibe-console {
            background: #1a1b26;
            color: #a9b1d6;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
            font-size: 11px;
            padding: 12px;
            border-radius: 6px;
            max-height: 180px;
            overflow-y: auto;
            margin-bottom: 12px;
            line-height: 1.6;
            scroll-behavior: smooth;
          }
          
          .vibe-console::-webkit-scrollbar {
            width: 6px;
          }
          
          .vibe-console::-webkit-scrollbar-track {
            background: #24283b;
          }
          
          .vibe-console::-webkit-scrollbar-thumb {
            background: #414868;
            border-radius: 3px;
          }
          
          .vibe-console-line {
            color: #9ece6a;
          }
          
          /* Progress Bar */
          .vibe-progress-bar {
            height: 4px;
            background: #e5e7eb;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 16px;
          }
          
          .vibe-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            transition: width 300ms ease-out;
          }
          
          /* Action Tiles */
          .vibe-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }
          
          .vibe-action-tile {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            font-size: 13px;
            animation: slideIn 200ms ease-out;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          .vibe-action-icon {
            font-size: 16px;
          }
          
          .vibe-action-text {
            flex: 1;
            color: #374151;
          }
          
          .vibe-action-status {
            color: #10b981;
            font-size: 12px;
          }
          
          /* Collapsible Log */
          .vibe-log {
            margin-top: 20px;
            transition: opacity 200ms ease-in-out;
          }
          
          .vibe-log.hidden {
            display: none;
          }
          
          .vibe-log-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            color: #6b7280;
            transition: all 150ms ease;
            user-select: none;
          }
          
          .vibe-log-toggle:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }
          
          .vibe-log-toggle-icon {
            transition: transform 200ms ease;
          }
          
          .vibe-log-toggle.expanded .vibe-log-toggle-icon {
            transform: rotate(180deg);
          }
          
          .vibe-log-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 250ms ease-in-out;
          }
          
          .vibe-log-content.expanded {
            max-height: 500px;
          }
          
          .vibe-timeline {
            padding: 16px 0;
          }
          
          .vibe-timeline-item {
            display: flex;
            gap: 12px;
            padding: 8px 0;
            border-left: 2px solid #e5e7eb;
            padding-left: 16px;
            margin-left: 8px;
          }
          
          .vibe-timeline-item:last-child {
            border-left-color: transparent;
          }
          
          .vibe-timeline-icon {
            flex-shrink: 0;
            width: 20px;
            height: 20px;
            background: #ffffff;
            border: 2px solid #e5e7eb;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            margin-left: -27px;
          }
          
          .vibe-timeline-icon.complete {
            background: #10b981;
            border-color: #10b981;
            color: white;
          }
          
          .vibe-timeline-content {
            flex: 1;
          }
          
          .vibe-timeline-title {
            font-size: 13px;
            color: #111827;
            font-weight: 500;
            margin-bottom: 2px;
          }
          
          .vibe-timeline-desc {
            font-size: 12px;
            color: #6b7280;
          }
          
          /* Widget Ready State */
          .vibe-widget-ready {
            padding: 12px;
            background: #f0fdf4;
            border: 1px solid #86efac;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #166534;
            font-weight: 500;
            margin-bottom: 12px;
            animation: slideIn 200ms ease-out;
          }
        </style>
        
        <div class="vibe-container">
          <!-- Progress UI -->
          <div class="vibe-progress-wrapper" id="progressWrapper">
            <div class="vibe-header">
              <div class="vibe-spinner" id="spinner"></div>
              <div class="vibe-title" id="title">Building your widget...</div>
            </div>
            
            <div class="vibe-bubbles" id="bubbles"></div>
            
            <div class="vibe-console" id="console" style="display: none;"></div>
            
            <div class="vibe-progress-bar">
              <div class="vibe-progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
            
            <div class="vibe-actions" id="actions"></div>
          </div>
          
          <!-- Log Toggle (shown after widget ready) -->
          <div class="vibe-log hidden" id="log">
            <div class="vibe-log-toggle" id="logToggle">
              <span>View Build Log</span>
              <span class="vibe-log-toggle-icon">▼</span>
            </div>
            <div class="vibe-log-content" id="logContent">
              <div class="vibe-timeline" id="timeline"></div>
            </div>
          </div>
        </div>
      `;
      
      const progressWrapper = el.querySelector('#progressWrapper');
      const spinner = el.querySelector('#spinner');
      const title = el.querySelector('#title');
      const bubbles = el.querySelector('#bubbles');
      const console = el.querySelector('#console');
      const progressFill = el.querySelector('#progressFill');
      const actions = el.querySelector('#actions');
      const log = el.querySelector('#log');
      const logToggle = el.querySelector('#logToggle');
      const logContent = el.querySelector('#logContent');
      const timeline = el.querySelector('#timeline');
      
      let bubbleQueue = [];
      let maxBubbles = 3;
      let lastStreamLength = 0;
      let completionHandled = false;
      
      function addBubble(message) {
        const bubble = document.createElement('div');
        bubble.className = 'vibe-bubble';
        bubble.textContent = message;
        bubbles.appendChild(bubble);
        
        bubbleQueue.push(bubble);
        
        if (bubbleQueue.length > maxBubbles) {
          const oldBubble = bubbleQueue.shift();
          oldBubble.classList.add('fade-out');
          setTimeout(() => oldBubble.remove(), 300);
        }
        
        setTimeout(() => {
          bubble.classList.add('fade-out');
          setTimeout(() => {
            bubble.remove();
            bubbleQueue = bubbleQueue.filter(b => b !== bubble);
          }, 300);
        }, 2000);
      }
      
      function addAction(action) {
        const tile = document.createElement('div');
        tile.className = 'vibe-action-tile';
        tile.style.animationDelay = `${actions.children.length * 50}ms`;
        tile.innerHTML = `
          <span class="vibe-action-icon">${action.icon || '✓'}</span>
          <span class="vibe-action-text">${action.message}</span>
          <span class="vibe-action-status">Done</span>
        `;
        actions.appendChild(tile);
      }
      
      function addTimelineItem(item) {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'vibe-timeline-item';
        timelineItem.innerHTML = `
          <div class="vibe-timeline-icon ${item.complete ? 'complete' : ''}">
            ${item.complete ? '✓' : item.icon || '○'}
          </div>
          <div class="vibe-timeline-content">
            <div class="vibe-timeline-title">${item.title}</div>
            <div class="vibe-timeline-desc">${item.description}</div>
          </div>
        `;
        timeline.appendChild(timelineItem);
      }
      
      // Specific update handlers (split for performance)
      
      function updateBubbles() {
        const microBubbles = model.get('micro_bubbles');
        if (microBubbles && microBubbles.length > 0) {
          const lastBubble = microBubbles[microBubbles.length - 1];
          if (lastBubble && lastBubble.new) {
            addBubble(lastBubble.message);
          }
        }
      }
      
      function updateActions() {
        const actionTiles = model.get('action_tiles');
        if (actionTiles && actionTiles.length > actions.children.length) {
          for (let i = actions.children.length; i < actionTiles.length; i++) {
            addAction(actionTiles[i]);
          }
        }
      }
      
      function updateProgress() {
        const progress = model.get('progress');
        progressFill.style.width = `${progress}%`;
      }
      
      function updateStream() {
        const streamText = model.get('stream_text');
        const newLength = streamText.length;
        
        if (newLength > lastStreamLength) {
          console.style.display = 'block';
          
          // Append-only: only add new text, don't rebuild entire console
          const newText = streamText.slice(lastStreamLength);
          const lines = newText.split('\\n').filter(line => line.trim());
          
          const fragment = document.createDocumentFragment();
          lines.forEach(line => {
            const div = document.createElement('div');
            div.className = 'vibe-console-line';
            div.textContent = line;
            fragment.appendChild(div);
          });
          
          console.appendChild(fragment);
          lastStreamLength = newLength;
          
          // Auto-scroll only if user is near bottom (prevent scroll jumping)
          const isNearBottom = console.scrollHeight - console.scrollTop - console.clientHeight < 50;
          if (isNearBottom) {
            console.scrollTop = console.scrollHeight;
          }
        }
      }
      
      function updateStatus() {
        const status = model.get('status');
        
        if (status === 'complete' && !completionHandled) {
          completionHandled = true;
          spinner.style.display = 'none';
          title.innerHTML = '✓ Widget ready!';
          title.style.color = '#10b981';
          
          // Remove progress wrapper completely after delay
          setTimeout(() => {
            progressWrapper.style.display = 'none';
            log.classList.remove('hidden');
          }, 1000);
        } else if (status === 'error') {
          spinner.style.display = 'none';
          title.innerHTML = '✗ Error';
          title.style.color = '#ef4444';
        }
      }
      
      function updateTimeline() {
        const timelineItems = model.get('timeline_items');
        if (timelineItems && timelineItems.length > timeline.children.length) {
          for (let i = timeline.children.length; i < timelineItems.length; i++) {
            addTimelineItem(timelineItems[i]);
          }
        }
      }
      
      // Log toggle handler
      logToggle.addEventListener('click', () => {
        const isExpanded = logContent.classList.contains('expanded');
        logContent.classList.toggle('expanded');
        logToggle.classList.toggle('expanded');
        logToggle.querySelector('span:first-child').textContent = 
          isExpanded ? 'View Build Log' : 'Hide Build Log';
      });
      
      // Initial render
      updateProgress();
      updateStream();
      updateBubbles();
      updateActions();
      updateStatus();
      updateTimeline();
      
      // Register specific listeners (not catch-all)
      model.on('change:micro_bubbles', updateBubbles);
      model.on('change:action_tiles', updateActions);
      model.on('change:progress', updateProgress);
      model.on('change:stream_text', updateStream);
      model.on('change:status', updateStatus);
      model.on('change:timeline_items', updateTimeline);
    }
    
    export default { render };
    """
    
    micro_bubbles = traitlets.List([]).tag(sync=True)
    action_tiles = traitlets.List([]).tag(sync=True)
    progress = traitlets.Float(0.0).tag(sync=True)
    stream_text = traitlets.Unicode("").tag(sync=True)
    status = traitlets.Unicode("running").tag(sync=True)
    log_visible = traitlets.Bool(False).tag(sync=True)
    timeline_items = traitlets.List([]).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(
            micro_bubbles=[],
            action_tiles=[],
            progress=0,
            stream_text="",
            status="running",
            log_visible=False,
            timeline_items=[],
            **kwargs
        )
        
    def add_micro_bubble(self, message: str):
        """Add an ephemeral status bubble."""
        bubbles = list(self.micro_bubbles)
        bubbles.append({"message": message, "new": True})
        self.micro_bubbles = bubbles
        
        # Reset 'new' flag after a tick
        import threading
        def reset_new():
            import time
            time.sleep(0.1)
            bubbles_reset = list(self.micro_bubbles)
            if bubbles_reset:
                bubbles_reset[-1]["new"] = False
                self.micro_bubbles = bubbles_reset
        threading.Thread(target=reset_new).start()
    
    def add_action_tile(self, icon: str, message: str):
        """Add a permanent action tile."""
        tiles = list(self.action_tiles)
        tiles.append({"icon": icon, "message": message})
        self.action_tiles = tiles
    
    def add_timeline_item(self, title: str, description: str, icon: str = "○", complete: bool = False):
        """Add an item to the timeline."""
        items = list(self.timeline_items)
        items.append({
            "title": title,
            "description": description,
            "icon": icon,
            "complete": complete
        })
        self.timeline_items = items
    
    def update_progress(self, percentage: float):
        """Update the progress bar."""
        self.progress = min(100, max(0, percentage))
    
    def add_stream(self, text: str):
        """Add text to the console stream."""
        self.stream_text += text
    
    def complete(self):
        """Mark as complete and show log toggle."""
        self.status = "complete"
        self.progress = 100
        self.log_visible = True
    
    def error(self, message: str):
        """Mark as error."""
        self.status = "error"
        self.stream_text += f"\n\nError: {message}"
