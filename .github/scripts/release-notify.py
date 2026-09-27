#!/usr/bin/env python3
"""检测 RSS 中的新文章，为每篇发布一个 GitHub Release。

读者通过仓库的 Watch → Releases only 订阅，GitHub 会在新 release 发布时
给他们发邮件通知，因此这里每检测到一篇新文章就发一个 release。
"""
import argparse
import datetime
import email.utils
import html
import re
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

FEED_URL = 'https://blog.waterfish.ren/rss/feed.xml'
TRACK_FILE = Path('released-posts.txt')
# 只对这段时间内发布的文章发通知。首次运行、或订阅窗口扩容后重新出现的旧文
# 会被登记但不通知，避免给订阅者一次性发一堆邮件。
NOTIFY_WINDOW_DAYS = 14
UTC_MIN = datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)


def fetch_items():
    with urllib.request.urlopen(FEED_URL, timeout=30) as resp:
        root = ET.fromstring(resp.read())
    items = []
    for node in root.iter('item'):
        link = (node.findtext('link') or '').strip()
        if '/article/' not in link:
            continue
        try:
            published = email.utils.parsedate_to_datetime(node.findtext('pubDate') or '')
        except (TypeError, ValueError):
            published = None
        if published and published.tzinfo is None:
            published = published.replace(tzinfo=datetime.timezone.utc)
        summary = html.unescape(re.sub(r'<[^>]+>', ' ', node.findtext('description') or ''))
        items.append({
            'link': link,
            'title': (node.findtext('title') or '').strip(),
            'published': published,
            'summary': re.sub(r'\s+', ' ', summary).strip(),
        })
    return items


def read_tracked():
    if not TRACK_FILE.exists():
        return None
    return {
        line.strip()
        for line in TRACK_FILE.read_text(encoding='utf-8').splitlines()
        if line.strip()
    }


def write_tracked(links):
    TRACK_FILE.write_text('\n'.join(sorted(links)) + '\n', encoding='utf-8')


def tag_of(link):
    return 'post-' + link.rstrip('/').rsplit('/', 1)[-1]


def publish(item, dry_run):
    tag = tag_of(item['link'])
    if dry_run:
        print(f'  [dry-run] 将发布 {tag} — {item["title"]}')
        return True
    if subprocess.run(['gh', 'release', 'view', tag],
                      capture_output=True, text=True).returncode == 0:
        print(f'  {tag} 已存在，跳过')
        return True
    result = subprocess.run(
        ['gh', 'release', 'create', tag,
         '--title', item['title'] or tag,
         '--notes', f"{item['summary']}\n\n原文：{item['link']}"],
        capture_output=True, text=True)
    if result.returncode != 0:
        print(f'  {tag} 发布失败：{result.stderr.strip()}', file=sys.stderr)
        return False
    print(f'  已发布 {tag} — {item["title"]}')
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help='只打印将要发布的 release，不实际创建、不更新登记文件')
    args = parser.parse_args()

    items = fetch_items()
    if not items:
        print('RSS 中没有文章，跳过')
        return

    tracked = read_tracked()
    if tracked is None:
        if args.dry_run:
            print(f'[dry-run] 首次运行：将登记 {len(items)} 篇文章，不发送通知')
            return
        write_tracked(i['link'] for i in items)
        print(f'首次运行：登记 {len(items)} 篇文章，不发送通知')
        return

    fresh = [i for i in items if i['link'] not in tracked]
    if not fresh:
        print('没有新文章')
        return

    fresh.sort(key=lambda i: i['published'] or UTC_MIN)
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        days=NOTIFY_WINDOW_DAYS)
    to_release = [i for i in fresh if i['published'] and i['published'] >= cutoff]
    if len(to_release) < len(fresh):
        print(f'{len(fresh) - len(to_release)} 篇超出 {NOTIFY_WINDOW_DAYS} 天窗口，仅登记不通知')

    release_links = {i['link'] for i in to_release}
    recorded = [i['link'] for i in fresh if i['link'] not in release_links]
    for item in to_release:
        if publish(item, args.dry_run):
            recorded.append(item['link'])

    if args.dry_run:
        print(f'[dry-run] 将登记 {len(recorded)} 篇文章')
        return
    write_tracked(tracked | set(recorded))


if __name__ == '__main__':
    main()
