# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "ubuntu/xenial64"
  config.vm.hostname = "lighterpack"
  config.vm.network "forwarded_port", auto_correct: true, guest: 3000, host: 3000, protocol: "tcp", id: "lighterpack/http"
  
  config.vm.provision "shell", env: {"NODE_ENV" => "development"}, inline: <<-SHELL
    required=(nodejs npm mongodb)
    i="apt cache"; printf "Checking: %s\n" "$i"
    if [ "$(( $(date +%s) - $(stat -c %Z /var/lib/apt/periodic/update-success-stamp) ))" -ge 86400 ]; then
        printf "Updating: %s\n" "$i"
        apt-get update -qy  > /dev/null 2>&1
    fi
    for i in "${required[@]}"; do
        printf "Checking: %s\n" "$i"; dpkg -s $i > /dev/null 2>&1 || printf "Installing: %s\n" "$i"; apt install -qy $i > /dev/null 2>&1
    done
    i="Node symlink"; printf "Checking: %s\n" "$i"
    if [ ! -h /usr/bin/node ]; then
        printf "Symlinking: %s\n" "$i"
        ln -sf "$(which nodejs)" /usr/bin/node
    fi
    i="Node modules"; printf "Checking: %s\n" "$i"
    if [ ! -d /vagrant/node_modules ]; then
        printf "Installing: %s\n" "$i"
        cd /vagrant && npm install --development > /dev/null 2>&1
    fi
    i="Systemd unit"; printf "Checking: %s\n" "$i"
    if [ ! -f /etc/systemd/system/lighterpack.service ]; then
        printf "Copying: %s\n" "$i"
        cp /vagrant/init/lighterpack.service /etc/systemd/system/lighterpack.service
        printf "Enabling: %s\n" "$i"
        systemctl enable lighterpack.service
    fi
    printf "Starting: %s\n" "$i"
    systemctl daemon-reload
    systemctl restart lighterpack.service
    printf "Done!"
  SHELL

end
