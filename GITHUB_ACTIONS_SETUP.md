# GitHub Actions Setup Guide

## What You Just Set Up

Your `deal-hygiene` script will now run **automatically every morning at 8:00 AM EST** in the cloud - completely free! Your computer doesn't need to be on.

---

## Step-by-Step Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Name your repository (e.g., `hubspot-deals-auto`)
3. Choose **Private** (recommended since this is business data)
4. **DO NOT** initialize with README, .gitignore, or license
5. Click **Create repository**

### Step 2: Add Your API Keys as GitHub Secrets

⚠️ **IMPORTANT**: Never commit your `.env` file or expose your API keys!

1. Go to your repository on GitHub
2. Click **Settings** tab (top right)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add your first secret:
   - **Name**: `HUBSPOT_ACCESS_TOKEN`
   - **Secret**: Paste your HubSpot access token
   - Click **Add secret**
6. Add your second secret:
   - **Name**: `OPENAI_API_KEY`
   - **Secret**: Paste your OpenAI API key
   - Click **Add secret**

### Step 3: Push Your Code to GitHub

Open your terminal/command prompt in this folder and run these commands:

```bash
# Add all files to git
git add .

# Create your first commit
git commit -m "Initial commit: Set up automated deal hygiene checker"

# Add your GitHub repository as the remote
# Replace YOUR-USERNAME and YOUR-REPO with your actual values
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Example** (replace with your details):
```bash
git remote add origin https://github.com/johnsmith/hubspot-deals-auto.git
git branch -M main
git push -u origin main
```

### Step 4: Verify the Workflow

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You should see "Daily Deal Hygiene Check" workflow listed
4. Click on it to see details

### Step 5: Test It Now (Optional)

Don't want to wait until tomorrow at 8am? Test it right now!

1. Go to **Actions** tab on GitHub
2. Click **Daily Deal Hygiene Check** on the left
3. Click **Run workflow** button (top right)
4. Click the green **Run workflow** button
5. Wait 1-2 minutes and refresh - you'll see the workflow running!
6. Click on the running workflow to see live logs

---

## How to View Results

### See the Logs:

1. Go to **Actions** tab on GitHub
2. Click on any workflow run
3. Click **deal-hygiene** job
4. Expand **Run deal hygiene check** step
5. You'll see all the output (the AI-generated email report)

### Get Notified:

By default, GitHub will email you if the workflow **fails**. To get notifications for successful runs:

1. Go to **Actions** tab
2. Click **Daily Deal Hygiene Check** workflow
3. Click the `...` menu (top right)
4. Click **View workflow runs**
5. Click **Watch** to get notifications

---

## Understanding the Schedule

The workflow uses **cron syntax** to schedule runs:

```yaml
cron: '0 13 * * *'
```

This means:
- `0` = minute 0
- `13` = hour 13 (1:00 PM UTC)
- `* * *` = every day, every month, every day of the week

**Important**: GitHub Actions uses **UTC timezone** (Coordinated Universal Time).

### Timezone Conversion Examples:

| Your Timezone | Time You Want | UTC Time | Cron Expression |
|--------------|---------------|----------|-----------------|
| EST (Eastern) | 8:00 AM | 1:00 PM | `'0 13 * * *'` |
| PST (Pacific) | 8:00 AM | 4:00 PM | `'0 16 * * *'` |
| CST (Central) | 8:00 AM | 2:00 PM | `'0 14 * * *'` |
| EST (Eastern) | 9:00 AM | 2:00 PM | `'0 14 * * *'` |

### How to Change the Time:

1. Open `.github/workflows/daily-deal-hygiene.yml`
2. Find the line with `cron: '0 13 * * *'`
3. Update the hour (remember to use UTC time)
4. Commit and push:
   ```bash
   git add .github/workflows/daily-deal-hygiene.yml
   git commit -m "Update schedule time"
   git push
   ```

Use [crontab.guru](https://crontab.guru/) to help write cron expressions!

---

## Troubleshooting

### ❌ Workflow failed: "HUBSPOT_ACCESS_TOKEN is not defined"

**Solution**: You forgot to add secrets. Go back to Step 2 above.

### ❌ Workflow failed: Module not found

**Solution**: The workflow installs dependencies automatically. If this happens:
1. Make sure your `package.json` and `package-lock.json` are committed
2. Run `npm install` locally
3. Commit the `package-lock.json` file
4. Push again

### ⚠️ Workflow didn't run at the scheduled time

**Reasons**:
- It can take 1-2 minutes after the scheduled time
- During high GitHub usage, it might be delayed by 5-10 minutes
- First run might take longer
- Check the Actions tab to see if it ran

### 📧 Want the email sent automatically?

The current setup **generates** the email report but doesn't send it. To automatically send emails:

**Option 1: Use a third-party service**
- Add a service like SendGrid, Mailgun, or Resend
- Modify `deal-hygiene.ts` to actually send the email

**Option 2: Copy-paste from logs**
- Go to Actions tab after each run
- Copy the email text from the logs
- Paste into your email client
- Send to your team

---

## Costs

✅ **Completely FREE** for:
- Public repositories (unlimited)
- Private repositories (2,000 minutes/month free)

Your workflow takes about 30-60 seconds per run, so even running daily:
- 60 seconds × 30 days = 1,800 seconds = **30 minutes/month**
- Well within the free 2,000 minutes!

---

## Next Steps

✅ **You're all set!** Your workflow will run automatically every morning at 8 AM.

**Optional enhancements**:
- Modify the email template in `src/deal-hygiene.ts`
- Add more required properties in `src/types.ts`
- Set up actual email sending (requires email service integration)
- Add Slack notifications instead of email
- Run it multiple times a day (e.g., also at 2 PM)

---

## Quick Reference Commands

```bash
# See git status
git status

# Make changes and commit
git add .
git commit -m "Your commit message"
git push

# View git remote
git remote -v

# Pull latest changes
git pull
```

---

## Need Help?

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Cron Expression Editor**: https://crontab.guru/
- **Your workflow file**: `.github/workflows/daily-deal-hygiene.yml`
