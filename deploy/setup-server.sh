#!/usr/bin/env bash
# 服务器初始化：在新买的 Ubuntu 服务器上运行一次。
#   sudo bash setup-server.sh
# 做的事：系统更新 → 装 nginx / 防火墙 / 自动安全更新 → 建 deploy 用户 → 建网站目录 → 配好 nginx → 开防火墙。
# 重复运行是安全的（已经做过的步骤会跳过或覆盖成同样的结果）。
set -euo pipefail

DEPLOY_USER=deploy                 # 以后发布网站用这个账号登录，不用 root
SITE_DIR=/var/www/zhijian          # 网站目录：releases/ 放每次发布的版本，current 指向正在用的那个

if [ "$(id -u)" -ne 0 ]; then echo "请用 sudo 运行：sudo bash $0"; exit 1; fi

echo "== 1/6 更新系统 =="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade

echo "== 2/6 安装 nginx、防火墙、自动安全更新 =="
apt-get install -y nginx ufw unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== 3/6 创建部署用户 $DEPLOY_USER =="
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
# 把当前登录用的公钥复制给 deploy，这样你的电脑可以直接用 deploy 登录
SRC_HOME=$(getent passwd "${SUDO_USER:-root}" | cut -d: -f6)
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [ -f "$SRC_HOME/.ssh/authorized_keys" ]; then
  cat "$SRC_HOME/.ssh/authorized_keys" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
  sort -u -o "/home/$DEPLOY_USER/.ssh/authorized_keys" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  echo "已把 $SRC_HOME/.ssh/authorized_keys 里的公钥加给 $DEPLOY_USER"
else
  echo "⚠ 没找到 $SRC_HOME/.ssh/authorized_keys。你是用密码登录的？请按指南第 2.3 步手动加公钥。"
fi

echo "== 4/6 创建网站目录 $SITE_DIR =="
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SITE_DIR" "$SITE_DIR/releases"
if [ ! -e "$SITE_DIR/current" ]; then
  # 第一次发布之前先放一个占位页，用来确认 nginx 通了
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SITE_DIR/releases/000-placeholder"
  echo '<!doctype html><meta charset="utf-8"><title>织鉴</title><h1>服务器已就绪</h1><p>等待第一次发布。</p>' \
    > "$SITE_DIR/releases/000-placeholder/index.html"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$SITE_DIR/releases/000-placeholder/index.html"
  ln -sfn "$SITE_DIR/releases/000-placeholder" "$SITE_DIR/current"
  chown -h "$DEPLOY_USER:$DEPLOY_USER" "$SITE_DIR/current"
fi

echo "== 5/6 配置 nginx（先用 IP + http，买了域名再上 https） =="
cat > /etc/nginx/sites-available/zhijian <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root  $SITE_DIR/current;
    index index.html;
    charset utf-8;

    # 文案没定稿前想只给自己人看，可以打开密码保护（见指南「可选：加访问密码」）
    # auth_basic "Zhijian Preview";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    location ~* \.html\$ { add_header Cache-Control "no-cache"; }
    location /assets/   { expires 7d; }
    location / { try_files \$uri \$uri/ =404; }
}
NGINX
ln -sfn /etc/nginx/sites-available/zhijian /etc/nginx/sites-enabled/zhijian
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== 6/6 防火墙：只开 SSH(22)、HTTP(80)、HTTPS(443) =="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

IP=$(curl -s --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}')
echo
echo "✓ 初始化完成。浏览器打开 http://$IP 应该看到「服务器已就绪」。"
echo "  下一步：在你的电脑上测试  ssh $DEPLOY_USER@$IP  能否免密登录（指南第 2.4 步）。"
