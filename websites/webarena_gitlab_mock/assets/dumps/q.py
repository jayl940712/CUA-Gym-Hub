"""psql helper: run a query in the gitlab container, return list of dicts."""
import subprocess, json

def q(sql):
    sql = " ".join(sql.split())
    wrapped = "SELECT coalesce(json_agg(t),'[]'::json) FROM (%s) t" % sql.rstrip(";")
    p = subprocess.run(["docker", "exec", "gitlab", "gitlab-psql", "-At", "-c", wrapped],
                       capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[:2000])
    return json.loads(p.stdout)

def git(disk_path, *args):
    r = "/var/opt/gitlab/git-data/repositories/%s.git" % disk_path
    p = subprocess.run(["docker", "exec", "gitlab", "/opt/gitlab/embedded/bin/git",
                        "--git-dir=" + r] + list(args), capture_output=True, text=True)
    return p.stdout
