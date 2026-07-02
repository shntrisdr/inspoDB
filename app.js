// app.js

const app = {
  tracks: [],
  samples: [],
  fuse: null,
  
  init: async function() {
    try {
      const [tracksRes, samplesRes] = await Promise.all([
        fetch('tracks.json'),
        fetch('samples.json')
      ]);
      
      this.tracks = await tracksRes.json();
      this.samples = await samplesRes.json();
      
      this.fuse = new Fuse(this.tracks, {
        keys: ['title', 'artist', 'aliases'],
        threshold: 0.3
      });
      
      this.setupRouting();
      this.showView('home-view');
      console.log('App initialized successfully');
    } catch (e) {
      console.error('Failed to initialize app', e);
    }
  },
  
  setupRouting: function() {
    // Basic routing to handle back button and hash changes could be added here
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.performSearch(e.target.value);
      });
    }
  },
  
  showView: function(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  },
  
  performSearch: function(query) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
    
    if (!query.trim()) {
      return;
    }
    
    const results = this.fuse.search(query);
    results.forEach(result => {
      const track = result.item;
      const li = document.createElement('li');
      li.textContent = `${track.artist} - ${track.title}`;
      li.onclick = () => this.showTrackDetail(track.id);
      resultsContainer.appendChild(li);
    });
  },
  
  showTrackDetail: function(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // Render basic info
    const content = document.getElementById('track-detail-content');
    content.innerHTML = `
      <h2>${track.artist} - ${track.title}</h2>
      <img class="thumbnail" src="https://img.youtube.com/vi/${track.youtubeId}/mqdefault.jpg" alt="${track.title} Thumbnail">
      <p>Aliases: ${track.aliases ? track.aliases.join(', ') : 'None'}</p>
    `;
    
    // Sampled Into (Target Tracks)
    const sampledIntoList = document.getElementById('sampled-into-list');
    sampledIntoList.innerHTML = '';
    const sampledInto = this.samples.filter(s => s.sourceTrackId === trackId);
    sampledInto.forEach(sample => {
      const targetTrack = this.tracks.find(t => t.id === sample.targetTrackId);
      if (targetTrack) {
        const li = document.createElement('li');
        li.textContent = `${targetTrack.artist} - ${targetTrack.title} (${sample.sampleType})`;
        li.onclick = () => this.showCompareView(sample);
        sampledIntoList.appendChild(li);
      }
    });

    // Sampled From (Source Tracks)
    const sampledFromList = document.getElementById('sampled-from-list');
    sampledFromList.innerHTML = '';
    const sampledFrom = this.samples.filter(s => s.targetTrackId === trackId);
    sampledFrom.forEach(sample => {
      const sourceTrack = this.tracks.find(t => t.id === sample.sourceTrackId);
      if (sourceTrack) {
        const li = document.createElement('li');
        li.textContent = `${sourceTrack.artist} - ${sourceTrack.title} (${sample.sampleType})`;
        li.onclick = () => this.showCompareView(sample);
        sampledFromList.appendChild(li);
      }
    });
    
    this.showView('track-detail-view');
  },
  
  showCompareView: function(sample) {
    const targetTrack = this.tracks.find(t => t.id === sample.targetTrackId);
    const sourceTrack = this.tracks.find(t => t.id === sample.sourceTrackId);
    
    if (!targetTrack || !sourceTrack) return;
    
    document.getElementById('target-title').textContent = `${targetTrack.artist} - ${targetTrack.title}`;
    document.getElementById('source-title').textContent = `${sourceTrack.artist} - ${sourceTrack.title}`;
    
    document.getElementById('target-start').textContent = sample.targetStartSeconds;
    document.getElementById('source-start').textContent = sample.sourceStartSeconds;
    document.getElementById('compare-sample-type').textContent = sample.sampleType;
    
    // Initialize or update players
    this.initPlayer('target-player', targetTrack.youtubeId, sample.targetStartSeconds, 'target-play-btn');
    this.initPlayer('source-player', sourceTrack.youtubeId, sample.sourceStartSeconds, 'source-play-btn');

    this.showView('compare-view');
  },

  players: {},

  initPlayer: function(elementId, videoId, startSeconds, playBtnId) {
    const container = document.getElementById(elementId);
    // Clear previous iframe
    container.innerHTML = '<div></div>';
    
    // We need to wait for YT API to be ready, but it's loaded asynchronously in HTML
    // We assume it's ready by the time a user clicks to compare.
    if (window.YT && window.YT.Player) {
      const player = new YT.Player(container.firstChild, {
        height: '200',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'start': startSeconds,
          'playsinline': 1
        }
      });
      
      this.players[elementId] = player;
      
      const playBtn = document.getElementById(playBtnId);
      // Remove old event listeners by cloning
      const newBtn = playBtn.cloneNode(true);
      playBtn.parentNode.replaceChild(newBtn, playBtn);
      
      newBtn.addEventListener('click', () => {
        if (player && player.seekTo) {
          player.seekTo(startSeconds);
          player.playVideo();
        }
      });
    }
  },

  setupSubmissionForm: function() {
    const form = document.getElementById('submit-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const target = document.getElementById('submit-target').value;
        const source = document.getElementById('submit-source').value;
        const type = document.getElementById('submit-type').value;

        const issueTitle = `New Data: ${target} sampled ${source}`;
        const issueBody = `**Target Track:** ${target}\n**Source Track:** ${source}\n**Sample Type:** ${type}\n\nPlease add this data.`;

        // Create github issue URL (assuming github.com/username/repo)
        // Since we don't know the exact repo, we'll create a generic one or use location.pathname
        // But for MVP, let's assume it's meant to point to the current repo hosting it, 
        // which can be constructed based on window.location if it's on GH pages, 
        // or a placeholder if running locally.
        const repoUrl = "https://github.com/placeholder/whosampled-mvp"; // Replace with actual
        
        const url = `${repoUrl}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
        
        window.open(url, '_blank');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
  app.setupSubmissionForm();
});
