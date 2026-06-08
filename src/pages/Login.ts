import { authService } from '../services/AuthService';

export const LoginPage = () => `
  <div class="login-container">
    <div class="login-bg-gradient"></div>
    <div class="login-glass-panel">
      <div class="login-header">
        <div class="turbine-icon-wrapper">
          <div class="turbine-tower" style="height: 35px;"></div>
          <div class="turbine-head" style="bottom: 0px; width: 60px; height: 60px;">
            <svg class="turbine-blades-svg" viewBox="0 0 100 100">
              <g transform="translate(50, 50)">
                <g id="login-blade">
                  <path d="M-2,0 C-2,-10 2,-10 2,0 L1,-38 C1,-40 -1,-40 -1,-38 Z" fill="currentColor" />
                </g>
                <use href="#login-blade" transform="rotate(120)" />
                <use href="#login-blade" transform="rotate(240)" />
                <circle r="3" fill="currentColor" />
              </g>
            </svg>
          </div>
        </div>
        <h1 style="font-family: 'Rajdhani', sans-serif; font-weight: 900; letter-spacing: 4px; font-size: 2.2rem; color: #fff; margin: 0; text-shadow: 0 0 20px rgba(100, 255, 218, 0.3);">
          DH_<span style="color: #64ffda;">SERVİS</span>
        </h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; font-weight: 700; letter-spacing: 3px; margin-top: 0.5rem; text-transform: uppercase;">BAKIM YÖNETİM SİSTEMİ</p>
      </div>

      <div style="margin: 2.5rem 0 1.5rem; text-align: center; position: relative;">
        <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(100, 255, 218, 0.2), transparent);"></div>
        <span style="background: rgba(10, 20, 30, 0.8); padding: 0 1rem; color: #64ffda; font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; position: relative; display: inline-block;">SİSTEM GİRİŞİ</span>
      </div>

      <form id="login-form">
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label style="color: rgba(255,255,255,0.7); font-size: 0.65rem; letter-spacing: 1.5px; font-weight: 800;"><i class="fa-solid fa-envelope" style="color: #64ffda; margin-right: 5px;"></i> E-POSTA ADRESİ</label>
          <input type="email" id="email" class="cyber-input" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(100, 255, 218, 0.15); box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); padding: 1rem;" placeholder="admin@demirerholding.com" required autocomplete="off">
        </div>
        <div class="form-group" style="margin-bottom: 2rem;">
          <label style="color: rgba(255,255,255,0.7); font-size: 0.65rem; letter-spacing: 1.5px; font-weight: 800;"><i class="fa-solid fa-lock" style="color: #64ffda; margin-right: 5px;"></i> ŞİFRE</label>
          <input type="password" id="password" class="cyber-input" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(100, 255, 218, 0.15); box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); padding: 1rem;" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn-cyber" style="width: 100%; justify-content: center; padding: 1rem; font-size: 0.9rem; letter-spacing: 2px; background: linear-gradient(135deg, #00ff88, #00cc6a); color: #000; box-shadow: 0 5px 20px rgba(0, 255, 136, 0.3); font-weight: 900; border-radius: 12px; transition: all 0.3s ease;">
          SİSTEME GİRİŞ YAP <i class="fa-solid fa-arrow-right-to-bracket" style="margin-left: 0.5rem; font-size: 1rem;"></i>
        </button>
      </form>

      <div id="login-error" class="hidden" style="margin-top: 1.5rem; color: #ff6b6b; font-size: 0.75rem; text-align: center; background: rgba(255, 107, 107, 0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255, 107, 107, 0.2); font-weight: 700; letter-spacing: 0.5px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Hatalı giriş bilgileri.
      </div>
    </div>
  </div>
`;

(window as any).handleLogin = async (e: Event) => {
  e.preventDefault();
  
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  
  if (!emailInput || !passwordInput) return;
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
      errorDiv.classList.remove('hidden');
      errorDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Lütfen tüm alanları doldurun.';
    }
    return;
  }

  const errorDiv = document.getElementById('login-error');
  const submitBtn = (e.target as HTMLFormElement).querySelector('button');

  if (errorDiv) errorDiv.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> BAĞLANILIYOR...';
  }

  try {
    await authService.login(email, password);
  } catch (error: any) {
    console.error("Login detail error:", error);
    if (errorDiv) {
      errorDiv.classList.remove('hidden');
      const errorCode = error.code || 'Giriş Başarısız';
      const errorMessage = error.message || 'Bilgilerinizi kontrol edip tekrar deneyin.';
      errorDiv.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i> 
        <strong>Hata:</strong> ${errorCode}<br>
        <small>${errorMessage}</small>
      `;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'SİSTEME GİRİŞ YAP <i class="fa-solid fa-right-to-bracket" style="margin-left: 0.5rem;"></i>';
    }
  }
};
