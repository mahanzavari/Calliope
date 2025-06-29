// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('loginPassword').value;
        // const errorMessage = document.getElementById('errorMessage');
        // errorMessage.style.display = 'none';
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                window.location.href = '/dashboard';
            } else {
                showError(data.error || 'Login failed.');
            }
        } catch (err) {
            showError('Network error. Please try again.');
        }
    });
}

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        // const errorMessage = document.getElementById('errorMessage');
        // errorMessage.style.display = 'none';
        if (!agreeTerms) {
            showError('You must agree to the terms.');
            return;
        }
        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                window.location.href = '/dashboard';
            } else {
                showError(data.error || 'Registration failed.');
            }
        } catch (err) {
            showError('Network error. Please try again.');
        }
    });
}

// Password strength and checklist for registration
const passwordInput = document.getElementById('password');
const passwordStrength = document.getElementById('passwordStrength');
const passwordChecklist = document.getElementById('passwordChecklist');

if (passwordInput && passwordStrength && passwordChecklist) {
    const requirements = [
        { regex: /.{8,}/, label: 'At least 8 characters' },
        { regex: /[A-Z]/, label: 'An uppercase letter' },
        { regex: /[a-z]/, label: 'A lowercase letter' },
        { regex: /\d/, label: 'A digit' },
        { regex: /[^A-Za-z0-9]/, label: 'A special character' },
    ];

    function getStrength(pw) {
        let score = 0;
        requirements.forEach(req => {
            if (req.regex.test(pw)) score++;
        });
        return score;
    }

    function updateChecklist(pw) {
        passwordChecklist.innerHTML = '';
        requirements.forEach(req => {
            const passed = req.regex.test(pw);
            const li = document.createElement('li');
            li.textContent = req.label;
            li.style.color = passed ? '#28a745' : '#dc3545';
            li.style.fontWeight = passed ? 'bold' : 'normal';
            passwordChecklist.appendChild(li);
        });
    }

    function updateStrengthBar(pw) {
        const score = getStrength(pw);
        let strengthText = '';
        let color = '';
        switch (score) {
            case 5:
                strengthText = 'Strong'; color = '#28a745'; break;
            case 4:
                strengthText = 'Good'; color = '#17a2b8'; break;
            case 3:
                strengthText = 'Medium'; color = '#ffc107'; break;
            case 2:
                strengthText = 'Weak'; color = '#fd7e14'; break;
            default:
                strengthText = 'Very Weak'; color = '#dc3545';
        }
        passwordStrength.textContent = strengthText;
        passwordStrength.style.color = color;
        passwordStrength.style.fontWeight = 'bold';
    }

    passwordInput.addEventListener('input', (e) => {
        const pw = e.target.value;
        updateChecklist(pw);
        updateStrengthBar(pw);
    });

    // Initialize on page load
    updateChecklist(passwordInput.value);
    updateStrengthBar(passwordInput.value);
}

// Show/Hide Password Toggle Logic
function setupPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input && toggle) {
        toggle.addEventListener('click', function () {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }
}
setupPasswordToggle('loginPassword', 'loginTogglePassword');
setupPasswordToggle('registerPassword', 'registerTogglePassword');
setupPasswordToggle('registerConfirmPassword', 'registerToggleConfirmPassword');

// Error message auto-hide logic
let errorTimeout;
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    if (errorTimeout) clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Live email validation
const emailInput = document.getElementById('email');
const emailValidation = document.getElementById('emailValidation');
if (emailInput && emailValidation) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    emailInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (!value) {
            emailValidation.textContent = '';
            return;
        }
        if (emailRegex.test(value)) {
            emailValidation.textContent = 'Valid email address';
            emailValidation.style.color = '#28a745';
        } else {
            emailValidation.textContent = 'Invalid email address format';
            emailValidation.style.color = '#dc3545';
        }
    });
} 