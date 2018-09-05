Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/xenial64"
  config.vm.provision "shell", privileged: false, inline: <<-SHELL

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -

echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt-get update
sudo apt-get install -y nodejs yarn build-essential

git clone https://github.com/rsimmons/voracious.git
cd voracious
yarn
cd app
yarn
cd ..
yarn rebuild-native

yarn react-build

yarn dist

mkdir -p /vagrant/dist
cp dist/*.AppImage /vagrant/dist

  SHELL
end
