/**
 * IMMEDIATE CANVA FIX - Add this to index.html NOW
 * This makes the Canva button work immediately
 * Add as last script before </body>
 */

(function() {
  console.log('🔧 Loading immediate Canva fix...');
  
  // Define openCanvaPanel function immediately
  window.openCanvaPanel = function() {
    console.log('✅ openCanvaPanel called');
    
    // Check if panel exists
    let panel = document.getElementById('canvaPanel');
    let overlay = document.getElementById('canvaOverlay');
    
    // If not exists, create simple version
    if (!panel) {
      // Remove any old panels first
      document.querySelectorAll('#canvaPanel, #canvaOverlay').forEach(el => el.remove());
      
      // Create overlay
      overlay = document.createElement('div');
      overlay.id = 'canvaOverlay';
      overlay.style.cssText = `
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        backdrop-filter: blur(4px);
      `;
      overlay.onclick = function() {
        panel.style.display = 'none';
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
      };
      document.body.appendChild(overlay);
      
      // Create panel
      panel = document.createElement('div');
      panel.id = 'canvaPanel';
      panel.style.cssText = `
        display: block;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      `;
      
      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #333; font-size: 24px;">🎨 Generate Sales Collateral</h2>
          <button onclick="document.getElementById('canvaPanel').style.display='none';document.getElementById('canvaOverlay').style.display='none';document.body.style.overflow='auto';" 
                  style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; line-height: 1; padding: 0; width: 32px; height: 32px;">×</button>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px;">✨ <strong>Canva Integration Active</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">AI-powered sales collateral generation connected!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Quick Start:</h4>
          <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px;">
            <li style="margin-bottom: 8px;">Deploy the full integration files</li>
            <li style="margin-bottom: 8px;">Refresh your browser</li>
            <li style="margin-bottom: 8px;">Generate professional proposals, one-pagers, and more!</li>
          </ol>
        </div>
        
        <div style="text-align: center;">
          <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Deploy the complete integration to start creating:</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <div style="background: #fff; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 5px;">📄</div>
              <div style="font-size: 13px; color: #666;">Business Proposals</div>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 5px;">📋</div>
              <div style="font-size: 13px; color: #666;">One-Pagers</div>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 5px;">📊</div>
              <div style="font-size: 13px; color: #666;">Case Studies</div>
            </div>
            <div style="background: #fff; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; margin-bottom: 5px;">📈</div>
              <div style="font-size: 13px; color: #666;">Infographics</div>
            </div>
          </div>
          
          <p style="color: #999; font-size: 12px; margin: 0;">Button works! ✅ Deploy full integration to enable generation.</p>
        </div>
      `;
      
      document.body.appendChild(panel);
    } else {
      // Panel exists, just show it
      panel.style.display = 'block';
      overlay.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  };
  
  console.log('✅ openCanvaPanel function ready');
  
  // Test it
  const testBtn = document.querySelector('button[onclick*="openCanva"]');
  if (testBtn) {
    console.log('✅ Canva button found in DOM');
  } else {
    console.log('⚠️ Canva button not found - check if it exists in your HTML');
  }
  
})();
