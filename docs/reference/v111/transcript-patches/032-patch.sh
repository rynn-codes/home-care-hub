cd /home/claude/joy && python3 - <<'EOF'
import re
p='src/pages/Assessment.tsx'
s=open(p).read()
old='''function AnswerInput({
  question,
  value,
  onChange,
  intake,
  admissionName,
}: {
  question: AssessmentQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  intake: Record<string, unknown>;
  admissionName: string;
}) {'''
assert s.count(old)==1
s=s.replace(old,'''function AnswerInput({
  question,
  value,
  onChange,
  intake,
  admissionName,
  focus = true,
}: {
  question: AssessmentQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  intake: Record<string, unknown>;
  admissionName: string;
  /** One question at a time takes focus; forty on one page must not. */
  focus?: boolean;
}) {''')
# every bare autoFocus inside AnswerInput becomes autoFocus={focus}
start=s.index('function AnswerInput(')
head, body = s[:start], s[start:]
n=body.count('autoFocus\n')
body=body.replace('autoFocus\n','autoFocus={focus}\n')
s=head+body
old2='''                          <AnswerInput
                            question={q}
                            value={answers[q.id]}
                            onChange={(v) => setAnswerFor(q.id, v)}
                            intake={intake?.answers ?? {}}
                            admissionName={admission.name}
                          />'''
assert s.count(old2)==1
s=s.replace(old2,'''                          <AnswerInput
                            question={q}
                            value={answers[q.id]}
                            onChange={(v) => setAnswerFor(q.id, v)}
                            intake={intake?.answers ?? {}}
                            admissionName={admission.name}
                            focus={false}
                          />''')
open(p,'w').write(s)
print("replaced",n)
EOF
npm run typecheck 2>&1 | grep -v "^>"; npm run lint 2>&1 | grep problems; npx vitest run 2>&1 | grep -E "Tests |FAIL"; npm run build:demo 2>&1 | tail -1 && timeout 240 node pw-new.mjs 2>&1 | head -50 && rm -f pw-new.mjs