// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.style.display = 'none';
        
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
                errorMessage.textContent = data.error || 'Login failed.';
                errorMessage.style.display = 'block';
            }
        } catch (err) {
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.style.display = 'block';
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
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.style.display = 'none';

        if (!agreeTerms) {
            errorMessage.textContent = 'You must agree to the terms.';
            errorMessage.style.display = 'block';
            return;
        }
        if (password !== confirmPassword) {
            errorMessage.textContent = 'Passwords do not match.';
            errorMessage.style.display = 'block';
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
                errorMessage.textContent = data.error || 'Registration failed.';
                errorMessage.style.display = 'block';
            }
        } catch (err) {
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.style.display = 'block';
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
setupPasswordToggle('password', 'togglePassword');
setupPasswordToggle('confirmPassword', 'toggleConfirmPassword'); 