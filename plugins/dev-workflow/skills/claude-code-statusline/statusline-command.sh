#!/usr/bin/env bash
# Claude Code status line — model, session tokens, context %, rate limits
input=$(cat)

# ANSI helpers
RESET='\033[0m'
CYAN='\033[36m'
WHITE='\033[97m'
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
SEP="${DIM} | ${RESET}"

# --- Extract fields via jq ---
model=$(echo "$input"    | jq -r '.model.display_name // "Claude"')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage   // empty')
rem_pct=$(echo "$input"  | jq -r '.context_window.remaining_percentage // empty')
total_in=$(echo "$input" | jq -r '.context_window.total_input_tokens  // 0')
total_out=$(echo "$input"| jq -r '.context_window.total_output_tokens // 0')
five_h=$(echo "$input"   | jq -r '.rate_limits.five_hour.used_percentage  // empty')
seven_d=$(echo "$input"  | jq -r '.rate_limits.seven_day.used_percentage  // empty')
five_h_resets_at=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

# --- Model (cyan) ---
out="${CYAN}${model}${RESET}"

# --- Session token usage ---
total_tokens=$(( ${total_in:-0} + ${total_out:-0} ))
if [ "$total_tokens" -ge 1000000 ]; then
    tok_str="$(( total_tokens / 1000000 ))M tok"
elif [ "$total_tokens" -ge 1000 ]; then
    tok_str="$(( total_tokens / 1000 ))k tok"
elif [ "$total_tokens" -gt 0 ]; then
    tok_str="${total_tokens} tok"
fi
[ -n "${tok_str:-}" ] && out="${out}${SEP}${WHITE}${tok_str}${RESET}"

# --- Context window % (traffic-light color) ---
if [ -n "$used_pct" ]; then
    ctx_used=$(printf "%.0f" "$used_pct")
    if [ "$ctx_used" -ge 75 ]; then
        ctx_color="$RED"
    elif [ "$ctx_used" -ge 50 ]; then
        ctx_color="$YELLOW"
    else
        ctx_color="$GREEN"
    fi
    ctx_rem=""
    [ -n "$rem_pct" ] && ctx_rem=" ($(printf "%.0f" "$rem_pct")% left)"
    out="${out}${SEP}${ctx_color}ctx:${ctx_used}%${ctx_rem}${RESET}"
fi

# --- Rate limits ---
rate_str=""
if [ -n "$five_h" ]; then
    pct=$(printf '%.0f' "$five_h")
    [ "$pct" -ge 75 ] && col="$RED" || { [ "$pct" -ge 50 ] && col="$YELLOW" || col="$DIM"; }
    reset_str=""
    if [ -n "$five_h_resets_at" ]; then
        now=$(date +%s)
        remaining=$(( five_h_resets_at - now ))
        if [ "$remaining" -gt 0 ]; then
            rh=$(( remaining / 3600 ))
            rm=$(( (remaining % 3600) / 60 ))
            if [ "$rh" -gt 0 ]; then
                reset_str=" (resets ${rh}h${rm}m)"
            else
                reset_str=" (resets ${rm}m)"
            fi
        fi
    fi
    rate_str="${col}5h:${pct}%${reset_str}${RESET}"
fi
if [ -n "$seven_d" ]; then
    pct=$(printf '%.0f' "$seven_d")
    [ "$pct" -ge 75 ] && col="$RED" || { [ "$pct" -ge 50 ] && col="$YELLOW" || col="$DIM"; }
    [ -n "$rate_str" ] && rate_str="${rate_str} "
    rate_str="${rate_str}${col}7d:${pct}%${RESET}"
fi
[ -n "$rate_str" ] && out="${out}${SEP}${rate_str}"

echo -e "$out"
